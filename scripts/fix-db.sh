#!/bin/bash

# Ensure script is run with sudo
if [ "$EUID" -ne 0 ]; then 
  echo "Please run as root (sudo)"
  exit
fi

echo "Stopping MySQL service..."
systemctl stop mysql || true
pkill -f mysqld || true

echo "Starting MySQL in safe mode..."
mkdir -p /var/run/mysqld
chown mysql:mysql /var/run/mysqld
mysqld_safe --skip-grant-tables --skip-networking &
SAFE_PID=$!

echo "Waiting for MySQL to start..."
sleep 10

echo "Executing SQL commands..."
# Run critical steps (App setup) BEFORE root password reset.
# If root reset fails, at least the app will work.
mysql -u root <<EOF
FLUSH PRIVILEGES;
-- 1. Create DB
CREATE DATABASE IF NOT EXISTS \`ecommerce-api\`;
-- 2. Create/Update App User
CREATE USER IF NOT EXISTS 'chijid1'@'localhost' IDENTIFIED BY 'chibuike4u';
-- Ensure legacy authentication just in case (optional, safe to add)
ALTER USER 'chijid1'@'localhost' IDENTIFIED WITH mysql_native_password BY 'chibuike4u';
-- 3. Grant Permissions
GRANT ALL PRIVILEGES ON \`ecommerce-api\`.* TO 'chijid1'@'localhost';
FLUSH PRIVILEGES;

-- 4. Try Root Reset (Last, so failure doesn't block above)
ALTER USER 'root'@'localhost' IDENTIFIED BY 'chibuike4u';
FLUSH PRIVILEGES;
EOF

echo "Stopping safe mode MySQL..."
kill $SAFE_PID || true
pkill -f mysqld || true
sleep 5

echo "Starting MySQL service normally..."
systemctl start mysql

echo "Done! Verifying locally..."
sleep 3
node scripts/test-db.js
