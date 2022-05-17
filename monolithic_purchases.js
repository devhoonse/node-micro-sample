/*
* import : 3rd-parties
* */
const mysql = require('mysql');
const redis = require('redis');

/*
* config : 데이터베이스 접속정보를 불러옵니다.
* */
const {
  DATABASE: DATABASE_CONFIG,
  REDIS: REDIS_CONFIG,
} = require('./CONFIG');

/*
* Redis 서버에 접속된 클라이언트 객체를 생성합니다.
* */
const redisClient = redis.createClient(REDIS_CONFIG);
redisClient.on('error',
  /**
   * Redis 와의 통신 중 에러가 발생했을 때 실행할 콜백 함수입니다.
   * @param error   에러 정보 객체
   */
  (error) => {
    console.error('[error] Redis failed with : ', error);
  }
);

/**
 * /purchases 에 대한 비즈니스 모듈입니다.
 * 요청받은 메서드에 따라 작업 내용이 분기됩니다.
 * @param res       response 객체
 * @param method    메서드
 * @param pathname  URI
 * @param params    입력 파라미터
 * @param cb        처리 완료 후 실행할 콜백 함수
 */
exports.onRequest = (res, method, pathname, params, cb) => {
  switch (method) {
    case "POST":
      return register(method, pathname, params, (response) => {
        process.nextTick(cb, res, response);
      });
    case "GET":
      return inquiry(method, pathname, params, (response) => {
        process.nextTick(cb, res, response);
      });
    default:
      return process.nextTick(cb, res, null);
  }
};

/**
 * 상품 구매(=구매내역 추가) I/O
 * @param method    메서드
 * @param pathname  URI
 * @param params    입력 파라미터
 * @param cb        처리 완료 후 실행할 콜백 함수
 */
function register(method, pathname, params, cb) {
  /*
  * default 응답 본문입니다.
  * */
  let response = {
    key: params.key,
    errorcode: 0,
    errormessage: "success",
  };

  /*
  * 구매내역 추가에 필요한 2 가지 값이 모두 빠짐없이 있는지 확인합니다.
  * */
  const { userid, goodsid } = params;
  if ([userid, goodsid].includes(null)) {
    /*
    * 2 가지 값 중 하나라도 누락된 경우, 입력 파라미터가 갖춰지지 않았다고 응답합니다.
    * */
    response.errorcode = 1;
    response.errormessage = "Invalid Parameters";
    cb(response);
  } else {

    /*
    * Redis 에서 해당 상품 ID 를 조회합니다.
    * 조회 결과에 문제가 있으면 예외 처리를 수행하고,
    * 문제가 없을 때에만 구매 처리 작업을 시작합니다.
    * */
    redisClient.get(params.goodsid,
      /**
       * Redis 에서 조회 요청에 대한 응답이 오면 실행할 콜백 함수입니다.
       * @param error
       * @param result
       */
      (error, result) => {
        /*
        * 조회 과정에서 문제가 발생했거나,
        * 해당 상품 ID 에 맞는 기록이 조회되지 않았을 경우,
        * 구매 처리 작업을 시작하지 않고 종료시킵니다.
        * */
        if (error || result === null) {
          response.errorcode = 1;
          response.errormessage = "Redis Failed";
          return cb(response);
        }

        /*
        * 구매내역 추가에 필요한 2 가지 값이 모두 있으면 구매내역 추가를 할 수 있습니다.
        * 이 블록에서는 데이터베이스에 접속하여 구매내역 추가 작업을 수행합니다.
        * */
        const connection = mysql.createConnection(DATABASE_CONFIG);
        connection.connect();

        /*
        * 구매내역 테이블에 신규 데이터 적재 작업을 실행합니다.
        * */
        connection.query(
          "insert into purchases(userid, goodsid) values(?, ?);",
          [userid, goodsid],
          /**
           * 데이터베이스 레코드 적재 작업이 완료된 경우 실행될 콜백 함수입니다.
           * 실패했을 경우, 실패 내용을 콜백을 통해 클라이언트에게 응답합니다.
           * @param error     데이터베이스 에러 내용을 담고 있는 객체입니다.
           * @param results   데이터베이스 작업 처리 결과 객체입니다. 조회문일 경우 데이터의 배열이 담깁니다.
           * @param fields     fixme: 데이터베이스 필드 목록입니다.
           */
          (error, results, fields) => {
            if (error) {
              response.errorcode = 1;
              response.errormessage = error;
            }
            cb(response);
          }
        );

        /*
        * 작업이 마무리되었으므로 데이터베이스와의 연결을 해제합니다.
        * */
        connection.end();
      }
    );
  }
}

/**
 * 구매내역 조회 /O
 * @param method    메서드
 * @param pathname  URI
 * @param params    입력 파라미터
 * @param cb        처리 완료 후 실행할 콜백 함수
 */
function inquiry(method, pathname, params, cb) {
  /*
  * default 응답 본문입니다.
  * */
  let response = {
    key: params.key,
    errorcode: 0,
    errormessage: "success",
  };

  /*
  * 구매내역 조회에 필요한 userid 값이 있는지 확인합니다.
  * */
  const { userid } = params;
  if ([userid].includes(null)) {
    /*
    * userid 값이 누락된 경우, 입력 파라미터가 갖춰지지 않았다고 응답합니다.
    * */
    response.errorcode = 1;
    response.errormessage = "Invalid Parameters";
    cb(response);
  } else {
    /*
    * 구매내역 조회를 위해 데이터베이스에 접속합니다.
    * */
    const connection = mysql.createConnection(DATABASE_CONFIG);
    connection.connect();

    /*
    * 구매내역 조회 쿼리를 실행합니다.
    * */
    connection.query(
      `select id, goodsid, date from purchases where userid = ?;`,
      [userid],
      /**
       * 데이터베이스 적재 작업이 완료된 경우 실행될 콜백 함수입니다.
       * 실행 결과를 콜백을 통해 클라이언트에게 응답합니다.
       * @param error     데이터베이스 에러 내용을 담고 있는 객체입니다.
       * @param results   데이터베이스 작업 처리 결과 객체입니다. 조회문일 경우 데이터의 배열이 담깁니다.
       * @param fields     fixme: 데이터베이스 필드 목록입니다.
       */
      (error, results, fields) => {
        if (error) {
          /*
          * 에러가 발생한 경우에 대한 응답 내용을 작성합니다.
          * */
          response.errorcode = 1;
          response.errormessage = error;
        } else {
          /*
          * 정상적으로 데이터가 조회된 경우, 응답 본문에 데이터를 담아줍니다.
          * */
          response.results = results;
        }
        cb(response);
      }
    );

    /*
    * 작업이 마무리되었으므로 데이터베이스와의 연결을 해제합니다.
    * */
    connection.end();
  }
}
