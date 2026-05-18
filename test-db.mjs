import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: 'gateway01.ap-northeast-1.prod.aws.tidbcloud.com',
  port: 4000,
  user: '2GZdvgpnbzpK3WU.root',
  password: 'CWUgGnj0d737w5R6',
  ssl: { rejectUnauthorized: false },
  connectTimeout: 10000,
});

console.log('연결 성공! wellness 데이터베이스 생성 중...');
await conn.execute("CREATE DATABASE IF NOT EXISTS wellness");
console.log('wellness 데이터베이스 생성 완료!');

await conn.end();
