#!/bin/bash
wget https://github.com/themattman/mongodb-raspberrypi-docker/releases/download/r7.0.4-mongodb-raspberrypi-docker-unofficial/mongodb.ce.pi4.r7.0.4-mongodb-raspberrypi-docker-unofficial.tar.gz;
docker load --input mongodb.ce.pi4.r7.0.4-mongodb-raspberrypi-docker-unofficial.tar.gz;
rm -rf ./mongodb.ce.pi4.r7.0.4-mongodb-raspberrypi-docker-unofficial.tar.gz
