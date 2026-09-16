Bootstrap Glyphicons Support
============================

Project Type
------------

This repository is a **static CSS/image asset pack** for
[Twitter's Bootstrap v2](http://twitter.github.com/bootstrap): it is not an
application, has no runtime, and contains no application code. It ships two
deliverables — a stylesheet that adds `icon-large` classes and a PNG sprite
with the 400+ GLYPHICONS — plus the verification tooling that keeps the
CSS/sprite mapping correct.

Repository layout
-----------------

    css/bootstrap.icon-large.css      Readable source of the icon mapping
    css/bootstrap.icon-large.min.css  Minified stylesheet (the shipped file)
    glyphicons.png                    The GLYPHICONS sprite
    img/glyphicons.png                Symlink to the sprite (matches the
                                      ../img/glyphicons.png URL in the CSS)
    tests/verify_css_mapping.js       Regression check for the mapping
    package.json                      Test entry point (npm test)

About
-----

[Twitter's Bootstrap v2](http://twitter.github.com/bootstrap) project already
uses GLYPHICONS halflings (created by [Jan Kovařík](http://glyphicons.com/))
and are released for Bootstrap under the Apache 2.0 License. What this project
aims to accomplish is add seamless support for the 400+ GLYPHICONS (available
for free under the
[Creative Commons Attribution 3.0 Unported (CC BY 3.0)](http://creativecommons.org/licenses/by/3.0/deed.en)
license) to Bootstrap so "large" icons can be used. To achieve this I've
combined the over 400 24x24 GLYPHICONS in to a Sprite and added icon-large
definitions.

Whenever possible larger GLYPHICONS halflings names have been mapped.
Otherwise the CSS class definition follows the names set by the files in the
zip.

To use this within your site you **NEED** to do the following:

 1. Download `bootstrap.icon-large.min.css` and place it in the same directory as bootstrap.css file
 2. Download `glyphicons.png` and place it in the same directory as glyphicons-halflings.png
 3. Add the following CSS definition under the bootstrap.css call
     `<link href="css/bootstrap.icon-large.min.css" rel="stylesheet">`
 4. Clearly visible on the site (like the footer) add a link to [glyphicons.com](http://www.glyphicons.com/). This is a [requirement by the artist](http://glyphicons.com/glyphicons-licenses/) unless you purchase the GLYPHICONS ALL or GLYPHICONS PRO plans. If you don't want to give attribution to the artist, at least pay him for his fantastic work.

That's it. You can find an entire listing of all the GLYPHICONS

Testing
-------

The repository ships a zero-dependency regression check that verifies the
CSS/sprite mapping stays correct:

```sh
npm test
```

It asserts that every `icon-large` class has a matching `background-position`
rule, that the minified and source stylesheets define the same icon set, and
that the referenced sprite exists and is a valid PNG. The same test runs in CI
on every push (see `.github/workflows/ci.yml`).

Run with Docker
---------------

To preview the assets in an isolated environment:

```sh
docker compose up --build
```

Then open <http://localhost:8080/css/bootstrap.icon-large.min.css> (or
<http://localhost:8080/img/glyphicons.png>) to confirm the files are served
with the same relative layout the CSS expects.

License
-------

See [LICENSE.md](LICENSE.md). The CSS mapping is derived from Bootstrap and is
Apache License 2.0; the GLYPHICONS sprite is CC BY 3.0 and requires visible
attribution to [glyphicons.com](http://www.glyphicons.com/) unless a
commercial license has been purchased.

Contributing
------------

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to add or fix icon mappings,
including the required `npm test` step.
