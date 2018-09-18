#!/bin/bash

docker build . -t gcr.io/mechmania2017/script-compiled-pull:latest
docker push gcr.io/mechmania2017/script-compiled-pull:latest
kubectl apply -f app.yaml
kubectl delete pods -l app=scripts