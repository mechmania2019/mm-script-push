#!/bin/bash

docker build . -t gcr.io/mechmania2017/script-push:latest
docker push gcr.io/mechmania2017/script-push:latest
kubectl apply -f app.yaml
kubectl delete pods -l app=scripts