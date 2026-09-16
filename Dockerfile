# Serve the bootstrap-glyphicons static asset pack exactly as documented in
# the README:
#   /css/bootstrap.icon-large.min.css  -> references ../img/glyphicons.png
#   /img/glyphicons.png                -> the sprite
FROM nginx:1.27-alpine

COPY css/ /usr/share/nginx/html/css/
COPY glyphicons.png /usr/share/nginx/html/img/glyphicons.png