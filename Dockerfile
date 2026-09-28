# Preview server for the bootstrap-glyphicons asset pack.
#
# Serves the pack with exactly the relative layout the stylesheets assume:
#   /css/bootstrap.icon-large.min.css  -> references ../img/glyphicons.png
#   /img/glyphicons.png                -> the sprite
#
# Hardening notes (see SECURITY.md):
#   - the base image is pinned to an exact patch tag, never `latest`
#   - the server runs as an unprivileged uid on a high port, so the container
#     needs no capabilities and no root filesystem write access
#   - the stock site config is replaced with docker/nginx.conf so the listen
#     port, pid file and temp directories are explicit and reviewable
FROM nginx:1.27.5-alpine

# Remove the image's default site; we ship our own so the document root layout
# is part of this repository and is covered by the test suite.
RUN rm -f /etc/nginx/conf.d/default.conf /usr/share/nginx/html/index.html

COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY css/ /usr/share/nginx/html/css/
COPY glyphicons.png /usr/share/nginx/html/img/glyphicons.png

# `nginx` is uid 101 in the base image. Running as a numeric uid keeps the
# container independent of name resolution and lets us drop every capability.
USER 101

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://127.0.0.1:8080/css/bootstrap.icon-large.min.css || exit 1
