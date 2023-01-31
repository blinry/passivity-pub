# PassivityPub

To run this on your own server:

- Run `npm install`
- Create a key pair, like this:

        openssl genrsa -out private.pem 2048
        openssl rsa -in private.pem -outform PEM -pubout -out public.pem
- Copy an avatar to `public/icon.png`
- Change the `domain` and `user` variables in *app.js*.
- Set up a reverse proxy from your domain to the port the app will run on (7800).
- Run `node app.js` and hope for the best! :D
