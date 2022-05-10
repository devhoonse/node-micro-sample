/*
* 각종 설정 정보들을 담고 있습니다.
* */
module.exports = {
  /*  데이터베이스 접속정보입니다. */
  DATABASE: {
    host: '192.168.0.2',
    user: 'micro',
    password: 'service',
    database: 'monolithic',
    multipleStatements: true,
  },
  REDIS: {
    url: "redis://redis-15986.c54.ap-northeast-1-2.ec2.cloud.redislabs.com:15986",
    password: 'aayhbwncIep2nNw22QqlD1hIpK3wTXZj',
  },
};
