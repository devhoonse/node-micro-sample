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
 * /goods 에 대한 비즈니스 모듈입니다.
 * 요청받은 메서드에 따라 작업 내용이 분기됩니다.
 * @param res       response 객체
 * @param method    메서드
 * @param pathname  URI
 * @param params    입력 파라미터
 * @param cb        처리 완료 후 실행할 콜백 함수 - response 객체를 매개 변수로 받습니다.
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
    case "DELETE":
      return unregister(method, pathname, params, (response) => {
        process.nextTick(cb, res, response);
      });
    default:
      return process.nextTick(cb, res, null);
  }
};

/**
 * 상품 등록 I/O
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
  * 상품 등록에 필요한 4 가지 값이 모두 빠짐없이 있는지 확인합니다.
  * */
  const { name, category, price, description } = params;
  if ([name, category, price, description].includes(null)) {
    /*
    * 4 가지 값 중 하나라도 누락된 경우, 입력 파라미터가 갖춰지지 않았다고 응답합니다.
    * */
    response.errorcode = 1;
    response.errormessage = "Invalid Parameters";
    cb(response);
  } else {
    /*
    * 상품 등록에 필요한 4 가지 값이 모두 있으면 상품 등록을 할 수 있습니다.
    * 이 블록에서는 데이터베이스에 접속하여 신규 상품 등록 작업을 수행합니다.
    * */
    const connection = mysql.createConnection(DATABASE_CONFIG);
    connection.connect();

    /*
    * 상품 테이블에 신규 데이터 적재 작업을 실행합니다.
    * */
    connection.query(
      "insert into goods(name, category, price, description) values(?, ?, ?, ?);select LAST_INSERT_ID() as id;",
      [name, category, price, description],
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
        } else {
          /*
          * 적재가 문제없이 완료되었다면, Redis 에 상품 정보를 저장합니다.
          * */
          const id = results[1][0].id;
          redisClient.set(id, JSON.stringify(params));
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

/**
 * 상품 조회 I/O
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
  * 상품 조회를 위해 데이터베이스에 접속합니다.
  * */
  const connection = mysql.createConnection(DATABASE_CONFIG);
  connection.connect();

  /*
  * 상품 목록을 조회 쿼리를 실행합니다.
  * */
  connection.query(
    "select * from goods;",
    /**
     * 데이터베이스 적재 작업이 완료된 경우 실행될 콜백 함수입니다.
     * 실행 결과를 콜백을 통해 클라이언트에게 응답합니다.
     * @param error     데이터베이스 에러 내용을 담고 있는 객체입니다.
     * @param results   데이터베이스 작업 처리 결과 객체입니다. 조회문일 경우 데이터의 배열이 담깁니다.
     * @param fields     fixme: 데이터베이스 필드 목록입니다.
     */
    (error, results, fields) => {
      if (error || results.length === 0) {
        /*
        * 에러가 발생했거나, 데이터가 없는 경우에 대한 응답 내용을 작성합니다.
        * */
        response.errorcode = 1;
        response.errormessage = error ? error : "no data";
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

/**
 * 상품 삭제 I/O
 * @param method    메서드
 * @param pathname  URI
 * @param params    입력 파라미터
 * @param cb        처리 완료 후 실행할 콜백 함수
 */
function unregister(method, pathname, params, cb) {
  /*
  * default 응답 본문입니다.
  * */
  let response = {
    key: params.key,
    errorcode: 0,
    errormessage: "success",
  };

  if (params.id === undefined) {
    /*
    * 에러가 발생했거나, 데이터가 없는 경우에 대한 응답을 작성합니다.
    * */
    response.errorcode = 1;
    response.errormessage = "Invalid Parameters";
    cb(response);
  } else {
    /*
    * 상품 삭제에 필요한 id 값이 있으면 상품 삭제를 할 수 있습니다.
    * 이 블록에서는 데이터베이스에 접속하여 상품 삭제 작업을 수행합니다.
    * */
    const connection = mysql.createConnection(DATABASE_CONFIG);
    connection.connect();

    /*
    * 상품 테이블에서 id 값에 대응되는 레코드 삭제 작업을 실행합니다.
    * */
    connection.query(
      "delete from goods where id = ?;",
      [params.id],
      /**
       * 데이터베이스 레코드 삭제 작업이 완료된 경우 실행될 콜백 함수입니다.
       * 실패했을 경우, 실패 내용을 콜백을 통해 클라이언트에게 응답합니다.
       * @param error     데이터베이스 에러 내용을 담고 있는 객체입니다.
       * @param results   데이터베이스 작업 처리 결과 객체입니다. 조회문일 경우 데이터의 배열이 담깁니다.
       * @param fields     fixme: 데이터베이스 필드 목록입니다.
       */
      (error, results, fields) => {
        if (error) {
          response.errorcode = 1;
          response.errormessage = error;
        } else {
          /*
          * 삭제가 문제없이 완료되었다면, Redis 에 상품 정보를 삭제합니다.
          * */
          redisClient.del(params.id);
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
