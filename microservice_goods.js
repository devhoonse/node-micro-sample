/*
* strict 모드를 사용합니다.
*   - syntax 에 문제가 있으면 프로세스가 실행되지 못하도록 하였습니다.
* */
'use strict';

/*
* import : built-ins
* */
const cluster = require('cluster');

/*
* import : user-defined modules
* */
const business = require('./monolithic_goods');
const TCPServer = require('./server');

/*
* Goods 클래스입니다.
* */
class Goods extends TCPServer {
  /**
   * constructor
   * 서버가 TCP 서버 인스턴스로서 생성되고,
   * 바로 TCP 서버가 시작됩니다.
   */
  constructor() {
    console.log('[start] process.argv : ', process.argv);

    /*
    * 서버가 TCP 서버 인스턴스로서 생성되고,
    * 바로 TCP 서버가 시작됩니다.
    * 이 서버가 처리 가능한 작업명은 아래와 같이 3 가지 입니다.
    * */
    super("goods",
      process.argv[2] ? Number(process.argv[2]) : 9010,
      ["POST/goods", "GET/goods", "DELETE/goods"],
    );

    /*
    * Distributor 서버에 연결합니다.
    * TCP 프로토콜로 연결하며,
    * 이제 Distributor 서버와의 연결을 유지하는 동안에는
    * 계속해서 네트워크 내의 다른 노드들의 상태 정보를 동기화해올 수 있습니다.
    * */
    this.connectToDistributor("127.0.0.1", 9000,
      /**
       * Distributor 서버 측으로부터 패킷을 받으면 실행할 콜백 함수입니다.
       * @param data  패킷 버퍼 데이터
       */
      (data) => {
        console.log('[notification] from Distributor : ', data);
      }
    );
  }

  /**
   * TCP 클라이언트로부터 패킷을 수신할 때마다 실행할 메서드입니다.
   * @param socket  패킷이 전송된 TCP 클라이언트와 연결된 소켓 객체
   * @param data    수신한 패킷 데이터 객체
   *                {
   *                  uri: string;
   *                  method: string;
   *                  key: number;
   *                  params: {
   *                    name: string;
   *                    port: number;
   *                    urls: Array<string>;
   *                  };
   *                }
   */
  onRead(socket, data) {
    super.onRead(socket, data);

    /*
    * /goods 에 대한 비즈니스 로직을 처리합니다.
    * */
    business.onRequest(socket, data.method, data.uri, data.params,
      /**
       * 처리 완료 후 실행할 콜백 함수입니다.
       * 패킷을 송신한 TCP 클라이언트 측으로 로직 처리 결과를 전달합니다.
       */
      (s, packet) => {
        socket.write(JSON.stringify(packet) + '¶');
      }
    );
  }
}


/*
* (Entry Point) Goods 서버를 구동합니다.
* 현재 프로세스가 부모 프로세스인지, 자식 프로세스인지
* 여부에 따라 다른 동작을 수행하도록 분기처리 합니다.
* */
if (cluster.isMaster) {
  /*
  * 부모 프로세스일 경우에 실행할 코드 블록입니다.
  * */

  /*
  * 자식 프로세스를 1 개 생성합니다.
  * (이 부분을 수정해서 여러 개 생성할 수 있게 하는 것도 좋습니다.)
  * */
  for (let i = 0 ; i < 1 ; i++) {
    cluster.fork();
  }

  /*
  * exit 이벤트 : 자식 프로세스의 종료 이벤트
  * 가 발생했을 때 실행할 동작을 정의합니다.
  * */
  cluster.on('exit',
    /**
     * 자식 프로세스의 종료 이벤트가 발생했을 때 실행할 콜백 함수입니다.
     * @param worker  자식 프로세스 정보 객체
     * @param code    fixme: 파악 필요
     * @param signal  fixme: 파악 필요
     */
    (worker, code, signal) => {
      console.log(`[exit] worker '${worker.process.pid}' - code: ${code} , signal: ${signal}`);
    }
  );

} else {
  /*
  * 자식 프로세스일 경우에 실행할 코드 블록입니다.
  * Goods 서버를 구동합니다.
  * */
  new Goods();
}
