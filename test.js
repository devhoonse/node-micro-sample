/*
* import : built-ins
* */
const http = require('http');

/*
* config : API 요청 정보입니다.
* */
let options = {
  host: '127.0.0.1',
  port: '8000',
  headers: {
    'Content-Type': 'application/json',
  },
};

/**
 * HTTP 요청을 전송합니다.
 * @param cb      응답 수신 완료 후 실행할 콜백 함수
 * @param params  매개 변수 객체
 */
function request(cb, params) {

  /*
  * 서버 측으로 HTTP 요청을 전송합니다.
  * */
  const req = http.request(options,
    /**
     * 서버로부터 요청에 대한 응답이 올 때마다 실행할 동작입니다.
     * @param res   response 객체
     */
    (res) => {
      /*
      * 서버 측으로부터 응답 버퍼를 수신할 때마다 data 변수로 이어붙여 줍니다.
      * */
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      /*
      * 서버로부터 응답 버퍼를 모두 수신하면 실행할 동작입니다.
      * 전달받은 콜백 함수 cb() 를 호출함으로써, 통신이 완료되었음을 알립니다.
      * */
      res.on('end', () => {
        console.group('[response]');
        console.log('options : ', options, );
        console.log('data : ', data);
        console.groupEnd();
        cb();
      });
    }
  );

  /*
  * POST , PUT 요청일 경우,
  * 매개 변수 목록을 문자열로 변환하고 본문에 담아서 서버로 전송하도록 합니다.
  * */
  if (params) {
    req.write(JSON.stringify(params));
  }

  /*
  * 요청 전송 작업을 마무리합니다.
  * */
  req.end();
}


/**
 * 상품 관리 API 테스트
 * @param callback  테스트 실행 완료 후 콜백 함수
 */
function goods(callback) {

  /*
  * POST -> GET -> DELETE 순으로 테스트 요청을 전송합니다.
  * */
  goods_post(() => {
    goods_get(() => {
      goods_delete(callback);
    });
  });

  /**
   * 상품 등록
   * @param cb  실행 완료 후 콜백 함수
   */
  function goods_post(cb) {
    /*
    * API 서버 측에 요청할 작업과 자원명을 설정합니다.
    * */
    options.method = 'POST';
    options.path = '/goods';

    /*
    * 매개 변수와 함께 API 서버 측에 요청을 전송합니다.
    * */
    request(cb, {
      name: 'test Goods',
      category: 'tests',
      price: 10000,
      description: 'test',
    });
  }

  /**
   * 상품 조회
   * @param cb  실행 완료 후 콜백 함수
   */
  function goods_get(cb) {
    /*
    * API 서버 측에 요청할 작업과 자원명을 설정합니다.
    * */
    options.method = 'GET';
    options.path = '/goods';

    /*
    * API 서버 측에 요청을 전송합니다.
    * (GET 요청이기 때문에 매개변수를 따로 주지 않았습니다.)
    * */
    request(cb);
  }

  /**
   * 상품 삭제
   * @param cb  실행 완료 후 콜백 함수
   */
  function goods_delete(cb) {
    /*
    * API 서버 측에 요청할 작업과 자원명을 설정합니다.
    * */
    options.method = 'DELETE';
    options.path = '/goods?id=1';

    /*
    * API 서버 측에 요청을 전송합니다.
    * (DELETE 요청이기 때문에 매개변수를 따로 주지 않았습니다.)
    * */
    request(cb);
  }
}

/**
 * 회원 관리 API 테스트
 * @param callback  테스트 실행 완료 후 콜백 함수
 */
function members(callback) {

  /*
  * DELETE -> POST -> GET 순으로 테스트 요청을 전송합니다.
  * */
  members_delete(() => {
    members_post(() => {
      members_get(callback);
    });
  });

  /**
   * 회원 등록
   * @param cb  실행 완료 후 콜백 함수
   */
  function members_post(cb) {
    /*
    * API 서버 측에 요청할 작업과 자원명을 설정합니다.
    * */
    options.method = 'POST';
    options.path = '/members';

    /*
    * 매개 변수와 함께 API 서버 측에 요청을 전송합니다.
    * */
    request(cb, {
      username: 'test_account',
      password: '1234',
      passwordConfirm: '1234',
    });
  }

  /**
   * 회원 인증
   * @param cb  실행 완료 후 콜백 함수
   */
  function members_get(cb) {
    /*
    * API 서버 측에 요청할 작업과 자원명을 설정합니다.
    * */
    options.method = 'GET';
    options.path = '/members?username=test_account&password=1234';

    /*
    * API 서버 측에 요청을 전송합니다.
    * (GET 요청이기 때문에 매개변수를 따로 주지 않았습니다.)
    * */
    request(cb);
  }

  /**
   * 회원 탈퇴
   * @param cb  실행 완료 후 콜백 함수
   */
  function members_delete(cb) {
    /*
    * API 서버 측에 요청할 작업과 자원명을 설정합니다.
    * */
    options.method = 'DELETE';
    options.path = '/members?username=test_account';

    /*
    * API 서버 측에 요청을 전송합니다.
    * (DELETE 요청이기 때문에 매개변수를 따로 주지 않았습니다.)
    * */
    request(cb);
  }
}

/**
 * 구매 관리 API 테스트
 * @param callback  테스트 실행 완료 후 콜백 함수
 */
function purchases(callback) {

  /*
  * POST -> GET 순으로 테스트 요청을 전송합니다.
  * */
  purchases_post(() => {
    purchases_get(() => {
      callback();
    });
  });

  /**
   * 회원 등록
   * @param cb  실행 완료 후 콜백 함수
   */
  function purchases_post(cb) {
    /*
    * API 서버 측에 요청할 작업과 자원명을 설정합니다.
    * */
    options.method = 'POST';
    options.path = '/purchases';

    /*
    * 매개 변수와 함께 API 서버 측에 요청을 전송합니다.
    * */
    request(cb, {
      userid: 1,
      goodsid: 1,
    });
  }

  /**
   * 회원 인증
   * @param cb  실행 완료 후 콜백 함수
   */
  function purchases_get(cb) {
    /*
    * API 서버 측에 요청할 작업과 자원명을 설정합니다.
    * */
    options.method = 'GET';
    options.path = '/purchases?userid=1';

    /*
    * API 서버 측에 요청을 전송합니다.
    * (GET 요청이기 때문에 매개변수를 따로 주지 않았습니다.)
    * */
    request(cb);
  }
}

/*
* /members -> /goods -> /purchases 순으로 테스트합니다.
* */
console.log('============================== [members] ==============================');
members(() => {
  console.log('============================== [goods] ==============================');
  goods(() => {
    console.log('============================== [purchases] ==============================');
    purchases(() => {
      console.log('[done]');
    });
  });
});
