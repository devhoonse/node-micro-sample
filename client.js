
/*
* strict 모드를 사용합니다.
*   - syntax 에 문제가 있으면 프로세스가 실행되지 못하도록 하였습니다.
* */
'use strict';

/*
* import : built-ins
* */
const net = require('net');

/*
* 특정 서버로의 TCP 연결을 관리하는 클래스입니다.
* */
class TCPClient {
  /**
   * constructor
   * @param host      서버의 호스트명
   * @param port      할당된 서비스 포트 번호
   * @param onCreate  접속 완료 시 실행할 콜백 함수       ({host, port}) => void
   * @param onRead    데이터 수신 시 실행할 콜백 함수      ({host, port}, data) => void
   * @param onEnd     접속 종료 이벤트에서 실행할 콜백 함수 ({host, port}) => void
   * @param onError   에러 발생 이벤트에서 실행할 콜백 함수 ({host, port}, error) => void
   */
  constructor(host, port, onCreate, onRead, onEnd, onError) {

    /*
    * 접속 대상 서버 정보를 보관합니다.
    * */
    this.options = {
      host,
      port,
    };

    /*
    * 전달받은 각 콜백함수들을 클라이언트 객체의 인스턴스 변수로 할당합니다.
    * */
    this.onCreate = onCreate;
    this.onRead = onRead;
    this.onEnd = onEnd;
    this.onError = onError;
  }

  /**
   * 접속 대상 서버로 TCP 연결을 시도합니다.
   */
  connect() {
    /*
    * TCP 서버로의 연결을 시도하고,
    * 연결 성공 이벤트가 발생하면 생성자로 전달받은 접속 완료 콜백 함수를 호출하여
    * 서버로의 연결이 성공하였음을 알립니다.
    * */
    this.client = net.connect(this.options,
      () => {
        if (this.onCreate) {
          this.onCreate(this.options);
        }
      }
    );

    /*
    * TCP 서버로부터 데이터를 수신하는 이벤트가 발생했을 때에 대한 실행 동작입니다.
    * */
    this.client.on('data',
      /**
       * 서버로부터 패킷 버퍼를 수신할 때마다 실행할 콜백 함수입니다.
       * @param data  패킷 버퍼
       */
      (data) => {
        /*
        * todo: 내용 파악하고 주석 달기
        * 마지막에 '¶' 문자를 붙이는 이유는,
        * TCP 통신의 특성상 한 번 수신할 때 여러 패킷을 합쳐서 수신할 경우도 있기 때문에,
        * 패킷별로 구분해서 처리하기 위한 구분자 역할이 필요하기 때문입니다.
        * */
        const sz = this.merge ? this.merge + data.toString() : data.toString();
        const arr = sz.split('¶');
        for (let index in arr) {
          if (sz.charAt(sz.length - 1) !== '¶' && n === arr.length - 1) {
            this.merge = arr[index];
            break;
          } else if (arr[index] === "") {
            break;
          } else {
            this.onRead(this.options, JSON.parse(arr[index]));
          }
        }
      }
    );

    /*
    * TCP 서버와의 연결 종료 이벤트가 발생했을 때에 대한 실행 동작입니다.
    * */
    this.client.on('close',
      () => {
        if (this.onEnd) {
          this.onEnd(this.options);
        }
      }
    );

    /*
    * TCP 서버와의 연결 중 에러 이벤트가 발생했을 때에 대한 실행 동작입니다.
    * */
    this.client.on('error',
      /**
       * TCP 서버와의 연결 중 에러가 발생하면 실행할 콜백 함수입니다.
       * @param error   에러 정보 객체
       */
      (error) => {
        if (this.onError) {
          this.onError(this.options, error);
        }
      }
    );
  }

  /**
   * TCP 서버로 데이터를 전송합니다.
   * @param packet  패킷
   */
  write(packet) {
    this.client.write(JSON.stringify(packet) + '¶');
  }
}

/*
* 준비된 TCP 클라이언트 클래스를 다른 곳에서 불러다 사용할 수 있도록 내보냅니다.
* */
module.exports = TCPClient;
