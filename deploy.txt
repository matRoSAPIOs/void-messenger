cd client
npm run build
scp -r build\* root@178.253.45.20:/var/www/html/
cd ..
git add .
git commit -m "update"
git push
scp -r build\* root@178.253.45.20:/var/www/html/
echo DONE!