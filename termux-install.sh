#!/data/data/com.termux/files/usr/bin/bash
set -e
pkg update -y
pkg install nodejs-lts git nano -y
npm install
[ -f .env ] || cp .env.example .env
