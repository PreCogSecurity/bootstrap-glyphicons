'use strict';

/**
 * Static validation of the containerised preview server.
 *
 * The preview exists so a contributor can confirm the assets are served with
 * the same relative layout the CSS expects, which makes the container part of
 * the published contract. These checks read the Dockerfile, the nginx config
 * and docker-compose.yml directly instead of shelling out to Docker, so they
 * run anywhere the suite runs.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { PATHS, ROOT, rel, readText } = require('./helpers/repo');
const { extractUrls } = require('./helpers/css');

const dockerfile = readText(PATHS.DOCKERFILE);
const compose = readText(PATHS.COMPOSE_FILE);
const nginxConf = readText(path.join(ROOT, 'docker', 'nginx.conf'));
const minCss = readText(PATHS.MIN_CSS);
const envExample = readText(PATHS.ENV_EXAMPLE);

/**
 * Container-side locations created by `COPY` instructions, split into the
 * directories that were copied wholesale and the individual files that were.
 */
function copyTargets(text) {
  const directories = new Set();
  const files = new Set();
  for (const line of text.split('\n')) {
    const match = line.match(/^\s*COPY\s+(?:--[^\s]+\s+)*(\S+)\s+(\S+)\s*$/i);
    if (!match) {
      continue;
    }
    const [, source, dest] = match;
    if (source.endsWith('/') || dest.endsWith('/')) {
      directories.add(path.posix.normalize(dest.replace(/\/+$/, '')));
    } else {
      files.add(path.posix.normalize(dest));
    }
  }
  return { directories, files };
}

function isInImage(containerPath, targets) {
  return (
    targets.files.has(containerPath) ||
    [...targets.directories].some((dir) => containerPath.startsWith(`${dir}/`))
  );
}

/** Expand `${VAR:-default}` against `.env.example`, as Compose would. */
function expandVariables(text) {
  return text.replace(/\$\{([A-Z][A-Z0-9_]*)(?::-([^}]*))?\}/g, (_, name, fallback) => {
    const declared = envExample.match(new RegExp(`^${name}=(.*)$`, 'm'));
    return declared ? declared[1].trim() : (fallback ?? '');
  });
}

const targets = copyTargets(dockerfile);
const docRoot = nginxConf.match(/^\s*root\s+(\S+);/m);

test.describe('Dockerfile', () => {
  test('the base image is pinned to an explicit version', () => {
    const from = dockerfile.match(/^\s*FROM\s+(\S+)/im);
    assert.ok(from, 'Dockerfile has no FROM instruction');
    assert.match(from[1], /:[^:]+$/, `base image "${from[1]}" is not pinned to a version tag`);
    assert.ok(!/:latest\s*$/i.test(from[1]), 'a `:latest` base image makes the preview unreproducible');
  });

  test('the container never runs as root', () => {
    const user = dockerfile.match(/^\s*USER\s+(\S+)/im);
    assert.ok(user, 'Dockerfile has no USER instruction; the preview would run the web server as root');
    assert.notEqual(user[1].trim(), 'root', 'the preview server must not run as root');
    assert.match(user[1], /^\d+$/, 'pin the numeric uid so the container does not depend on name resolution');
  });

  test('the sprite and stylesheet land where the CSS expects them', () => {
    assert.ok(docRoot, 'docker/nginx.conf has no `root` directive');

    const urls = extractUrls(minCss);
    assert.ok(urls.length > 0, 'the stylesheet references no sprite');
    for (const url of urls) {
      const resolved = path.posix.normalize(path.posix.join(docRoot[1], 'css', url));
      assert.ok(
        isInImage(resolved, targets),
        `stylesheet references ${url} -> ${resolved}, which no COPY instruction places in the image`
      );
    }
  });

  test('the readable stylesheet is published to the image too', () => {
    assert.ok(docRoot, 'docker/nginx.conf has no `root` directive');
    const shipped = path.posix.join(docRoot[1], 'css', 'bootstrap.icon-large.min.css');
    assert.ok(isInImage(shipped, targets), `${shipped} is not copied into the image`);
  });

  test('no build secrets are baked in', () => {
    const credential = dockerfile.match(/^\s*(ARG|ENV)\s+\S*(TOKEN|SECRET|PASSWORD|KEY|CREDENTIAL)/im);
    assert.ok(!credential, `Dockerfile declares a credential-shaped variable: ${credential?.[0].trim()}`);
  });
});

test.describe('docker/nginx.conf', () => {
  test('it listens on a high, unprivileged port that EXPOSE agrees with', () => {
    const listen = nginxConf.match(/^\s*listen\s+(\d+)/m);
    assert.ok(listen, 'nginx.conf has no listen directive');
    assert.ok(Number(listen[1]) >= 1024, `port ${listen[1]} is privileged; a non-root container cannot bind it`);

    const exposed = dockerfile.match(/^\s*EXPOSE\s+(\d+)/im);
    assert.ok(exposed, 'Dockerfile has no EXPOSE instruction');
    assert.equal(exposed[1], listen[1], 'EXPOSE and the nginx listen port disagree');
  });

  test('its pid and temp paths live under /tmp so a read-only root works', () => {
    const pid = nginxConf.match(/^\s*pid\s+(\S+);/m);
    assert.ok(pid, 'nginx.conf has no pid directive');
    assert.ok(pid[1].startsWith('/tmp/'), `pid ${pid[1]} is outside /tmp and is not writable by a non-root process`);

    const tempPaths = [...nginxConf.matchAll(/^\s*\w*temp_path\s+(\S+);/gm)].map((match) => match[1]);
    assert.ok(tempPaths.length > 0, 'nginx.conf should pin its temp paths for a read-only root filesystem');
    for (const tempPath of tempPaths) {
      assert.ok(tempPath.startsWith('/tmp/'), `temp path ${tempPath} is outside /tmp`);
    }
  });

  test('it does not leak the server version or serve dotfiles', () => {
    assert.match(nginxConf, /server_tokens\s+off/, 'nginx.conf should set server_tokens off');
    assert.match(
      nginxConf,
      /location\s+~\s+\/[^\s]*\.\s*\{[^}]*deny\s+all\s*;/,
      'nginx.conf should deny requests for dotfiles (.git, .env, editor swap files)'
    );
    assert.match(nginxConf, /try_files\s+\$uri\s+=404/, 'nginx.conf must not fall back to a directory listing');
  });

  test('no CGI/PHP/proxy handlers are enabled', () => {
    // A static asset server that can execute upstream scripts is a much larger
    // attack surface than this pack needs.
    for (const directive of ['fastcgi_pass', 'proxy_pass', 'perl', 'lua', 'js_content']) {
      assert.ok(!nginxConf.includes(directive), `nginx.conf enables ${directive}; the asset preview must stay static`);
    }
  });
});

test.describe('docker-compose.yml', () => {
  const published = (compose.match(/^\s*-\s*"?([^\n"]+)"?\s*$/gm) ?? [])
    .map((line) => line.replace(/^\s*-\s*"?/, '').replace(/"?\s*$/, ''))
    .filter((entry) => /:\d+:\d+$/.test(expandVariables(entry)));

  test('the preview publishes a port', () => {
    assert.ok(published.length > 0, 'compose file publishes no ports');
  });

  test('the published port is bound to loopback by default', () => {
    for (const entry of published) {
      const [host] = expandVariables(entry).split(':');
      assert.ok(
        host === '127.0.0.1' || host === 'localhost',
        `port mapping "${entry}" binds every interface; an unauthenticated preview server should default to loopback`
      );
    }
  });

  test('the container port matches the port nginx listens on', () => {
    const listen = nginxConf.match(/^\s*listen\s+(\d+)/m)[1];
    for (const entry of published) {
      const parts = expandVariables(entry).split(':');
      assert.equal(parts[2], listen, `port mapping "${entry}" does not forward to the nginx listen port`);
    }
  });

  test('the container is not privileged and does not use host namespaces', () => {
    assert.ok(!/privileged\s*:\s*true/.test(compose), 'compose sets privileged: true');
    assert.ok(!/network_mode\s*:\s*host/.test(compose), 'compose uses host networking');
    assert.ok(!/^\s*pid\s*:\s*host/m.test(compose), 'compose joins the host PID namespace');
  });

  test('the compose service hardens the container', () => {
    assert.match(compose, /no-new-privileges/, 'compose should set the no-new-privileges security option');
    assert.match(compose, /cap_drop/, 'compose should drop all Linux capabilities');
    assert.match(compose, /read_only/, 'compose should mount the container root filesystem read-only');
  });

  test('no host paths are bind-mounted into the preview', () => {
    // A bind mount would let a local edit change what the container serves and
    // would re-introduce `.git` and `.env` into the preview's reach.
    assert.ok(!/^\s*volumes\s*:/m.test(compose), 'compose declares a volumes: section; the preview needs none');
    assert.ok(!/^\s*-\s*\.{1,2}[/\\]/m.test(compose), 'compose bind-mounts a host-relative path');
  });

  test('it does not load an env file with credentials', () => {
    assert.ok(!/env_file\s*:/.test(compose), 'compose loads env_file; the preview needs no secrets');
  });
});

test.describe('.dockerignore', () => {
  const ignored = readText(PATHS.DOCKERIGNORE)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));

  test('it exists and keeps the build context free of secrets and history', () => {
    assert.ok(fs.existsSync(PATHS.DOCKERIGNORE), `${rel(PATHS.DOCKERIGNORE)} is missing`);
    for (const required of ['.git', '.env', 'node_modules']) {
      assert.ok(
        ignored.some((pattern) => pattern === required || pattern === `/${required}`),
        `.dockerignore must exclude ${required}`
      );
    }
  });

  test('it still lets every COPY source reach the build context', () => {
    // Excluding a directory the Dockerfile copies produces a build failure
    // with an unhelpful message, so it is checked here instead of by surprise.
    for (const source of ['css', 'docker', 'glyphicons.png']) {
      assert.ok(
        !ignored.some((pattern) => pattern === source || pattern === `${source}/`),
        `.dockerignore excludes ${source}, which the Dockerfile copies`
      );
    }
  });
});
