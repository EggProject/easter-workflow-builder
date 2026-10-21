#!/bin/bash
. ~/envrc
cd ~/wt/m2
flock /tmp/kapu-gep.lock bun x turbo run lint --concurrency=1 > ~/meres/t010-5/raw/lint-full.txt 2>&1
echo "EXIT $?" >> ~/meres/t010-5/raw/lint-full.txt
