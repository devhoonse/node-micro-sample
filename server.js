
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
* import : user-defined modules
* */
const TCPClient = require('./client');

/*
* TCP 서버 클래스입니다.
* */
class TCPServer {
  /**
   * constructor
   * TCPServer 인스턴스를 생성함과 동시에,
   * TCP 서버를 구동합니다.
   * @param name  서버명
   * @param port  리슨 포트
   * @param urls  처리 가능한 작업명 목록
   */
  constructor(name, port, urls) {

    /*
    * 로그 관리 마이크로서비스에 연결된 클라이언트 객체를 할당할 인스턴스 변수 선언입니다.
    * */
    this.logTCPClient = null;

    /*
    * 생성할 TCP 서버의 정보를 담습니다.
    * */
    this.context = {
      name,
      port,
      urls,
    };

    /*
    * fixme: 변수 역할 파악 후 주석 달아둘 것.
    * */
    this.merge = {};

    /*
    * TCP 서버를 기동합니다.
    * */
    this.server = net.createServer(
      /**
       * 새로운 TCP 클라이언트가 연결될 때마다 실행할 콜백 함수입니다.
       * @param socket  클라이언트와 연결된 소켓 객체
       */
      (socket) => {

        /*
        * 새 TCP 클라이언트가 연결되었음을 알리는 함수를 호출합니다.
        * */
        this.onCreate(socket);

        /*
        * TCP 클라이언트와의 연결 중 에러 이벤트가 발생했을 때에 대한 실행 동작입니다.
        * */
        socket.on('error',
          /**
           * TCP 클라이언트와의 연결 중 에러가 발생하면 실행할 콜백 함수입니다.
           * fixme: (검증 필요) 에러가 발생하면 소켓 연결 또한 끊어지기 때문에,
           *        TCP 클라이언트와의 연결이 종료되었음을 알리는 this.onClose() 메서드를 호출합니다.
           * @param error   에러 정보 객체
           */
          (error) => {
            this.onClose(socket);
          }
        );

        /*
        * TCP 클라이언트와의 연결 종료 이벤트가 발생했을 때에 대한 실행 동작입니다.
        * TCP 클라이언트와의 연결이 종료되었음을 알리는 this.onClose() 메서드를 호출합니다.
        * */
        socket.on('close', () => {
          this.onClose(socket);
        });

        /*
        * TCP 클라이언트로부터 데이터를 수신하는 이벤트가 발생했을 때에 대한 실행 동작입니다.
        * */
        socket.on('data',
          /**
           * TCP 클라이언트로부터 패킷 버퍼를 수신할 때마다 실행할 콜백 함수입니다.
           * @param data  패킷 버퍼
           * */
          (data) => {
            /*
            * fixme: 내용 파악하고 주석 달기
            * 마지막에 '¶' 문자를 붙이는 이유는,
            * TCP 통신의 특성상 한 번 수신할 때 여러 패킷을 합쳐서 수신할 경우도 있기 때문에,
            * 패킷별로 구분해서 처리하기 위한 구분자 역할이 필요하기 때문입니다.
            * */
            const key = `${socket.remoteAddress}:${socket.remotePort}`;
            const sz = this.merge[key]
              ? this.merge[key] + data.toString()
              : data.toString();
            const arr = sz.split('¶');
            for (let index in arr) {
              if (sz.charAt(sz.length - 1) !== '¶' && index === arr.length - 1) {
                this.merge[key] = arr[index];
                break;
              } else if (arr[index] === "") {
                break;
              } else {
                /*
                * 수신된 패킷 데이터를 로그 마이크로서비스에게 전달하고,
                * this.onRead() 메서드를 호출합니다.
                * (로그 먼저 적재하고 나서 자기 본래 할 일을 하는 것입니다.)
                * */
                this.writeLog(arr[index]);
                this.onRead(socket, JSON.parse(arr[index]));
              }
            }
          }
        );
      }
    );

    /*
    * TCP 서버에서 에러 이벤트가 발생했을 때에 대한 실행 동작입니다.
    * */
    this.server.on('error',
      /**
       * TCP 서버 실행 중 에러가 발생하면 실행할 콜백 함수입니다.
       * @param error   에러 내용 객체
       * */
      (error) => {
        console.error('[error] failed with : ', error);
      }
    );

    /*
    * 준비된 TCP 서버를 서비스 포트에 할당합니다.
    * */
    this.server.listen(port, () => {
      console.log('[start] serving on ', this.server.address());
    });

  }

  /**
   * 새 TCP 클라이언트와 연결될 때마다 실행할 메서드입니다.
   * 기본적으로는 단순한 콘솔 출력만 합니다.
   * @param socket  새 TCP 클라이언트와 연결된 소켓 객체
   */
  onCreate(socket) {
    console.log('[connected] connection : ', socket.remoteAddress, ' , ', socket.remotePort);
  }

  /**
   * TCP 클라이언트로부터 패킷을 수신할 때마다 실행할 메서드입니다.
   * 기본적으로는 콘솔 출력만 합니다.
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
    console.group('[received]');
    console.log('data : ', data);
    console.log('from : ', socket.remoteAddress, ':', socket.remotePort);
    console.groupEnd();
  }

  /**
   * TCP 클라이언트와의 연결이 종료될 때마다 실행할 메서드입니다.
   * 기본적으로는 단순한 콘솔 출력만 합니다.
   * @param socket  종료된 클라이언트와 연결된 소켓 객체
   */
  onClose(socket) {
    console.log('[closed] connection : ', socket.remoteAddress, ' , ', socket.remotePort);
  }

  /**
   * Distributor 접속 기능을 수행하는 메서드입니다.
   * @param host      Distributor 서버의 호스트명
   * @param port      Distributor 서버 포트 번호
   * @param onNotify  Distributor 서버 측으로부터 패킷을 받으면 실행할 콜백 함수입니다.
   */
  connectToDistributor(host, port, onNotify) {
    /*
    * Distributor 서버에 연결될 때마다
    * Distributor 서버 측에 보낼 패킷입니다.
    * */
    const packet = {
      uri: '/distributes',
      method: 'POST',
      key: 0,
      params: this.context,
    };

    /*
    * Distributor 서버와의 TCP 연결 상태를 boolean 값으로 관리합니다.
    * */
    let isConnectedDistributor = false;

    /*
    * Distributor 서버에 대한 접속 정보를 설정하고,
    * 각 TCP 연결 이벤트 상황에 대한 콜백 함수들을 설정한 후에,
    * Distributor 서버에 접속합니다.
    * */
    this.clientDistributor = new TCPClient(
      host,
      port,
      /**
       * 접속 완료 시 실행할 콜백 함수
       * @param options {host, port}
       */
      (options) => {
        /*
        * 연결에 성공하였으므로 연결 상태 값을 true 로 변경하고,
        * Distributor 서버 측에 packet 을 전송합니다.
        * */
        console.log('[connected] to Distributor : ', options);
        isConnectedDistributor = true;
        this.clientDistributor.write(packet);
      },
      /**
       * Distributor 서버로부터 데이터 수신 시 실행할 콜백 함수
       * @param options {host, port}
       * @param data    수신한 데이터 객체
       */
      (options, data) => {
        /*
        * 로그 마이크로서비스로 TCP 연결을 시도합니다.
        * (이미 로그 마이크로서비스와의 TCP 연결이 체결된 상태이거나,
        *  자기 자신이 로그 마이크로서비스이면 하지 않습니다.)
        * */
        if (this.logTCPClient === null && this.context.name !== 'logs') {
          /*
          * 목록에 담겨 있는 각 마이크로서비스 노드들에 대해 실행합니다.
          * */
          for (let index in data.params) {
            /*
            * 로그 마이크로서비스 노드라면, TCP 연결을 시도합니다.
            * */
            const node = data.params[index];
            if (node.name === 'logs') {
              this.connectToLog(node.host, node.port);
            }
          }
        }

        /*
        * 전달받은 콜백 함수를 실행합니다.
        * */
        onNotify(data);
      },
      /**
       * 접속 종료 이벤트에서 실행할 콜백 함수
       * 연결 상태 값을 false 로 변경합니다.
       * @param options {host, port}
       */
      (options) => {
        isConnectedDistributor = false;
      },
      /**
       * 에러 발생 이벤트에서 실행할 콜백 함수
       * fixme: (검증 필요) 에러가 발생하면 소켓 연결 또한 끊어지기 때문에,
       *        연결 상태 값을 false 로 변경합니다.
       * @param options {host, port}
       * @param error   에러 정보 객체
       */
      (options, error) => {
        isConnectedDistributor = false;
      },
    );

    /*
    * 매 3 초마다
    * Distributor 서버와의 연결 상태를 점검하고,
    * 연결이 해제된 상태일 경우 다시 접속을 시도하는 동작을 수행합니다.
    * */
    setInterval(() => {
      if (isConnectedDistributor === false) {
        this.clientDistributor.connect();
      }
    }, 3000);
  }

  /**
   * 로그 마이크로서비스로 TCP 연결을 시도합니다.
   * @param host
   * @param port
   */
  connectToLog(host, port) {
    this.logTCPClient = new TCPClient(host, port,
      /**
       * 접속 완료 시 실행할 콜백 함수
       * @param options   fixme: {host, port}
       */
      (options) => {
        console.log('[connected] to Log Service : ', options);
      },
      /**
       * onRead
       * @param options   fixme: {host, port}
       */
      (options) => {},
      /**
       * 로그 마이크로서비스와의 연결이 끊어졌을 때 실행할 콜백 함수입니다.
       * 인스턴스 변수 this.logTCPClient 에 대한 참조를 제거합니다.
       * @param options   fixme: {host, port}
       */
      (options) => {
        this.logTCPClient = null;
        console.warn('[disconnected] from Log Service : ', options);
      },
      /**
       * 로그 마이크로서비스와의 통신 중 에러가 발생했을 때 실행할 콜백 함수입니다.
       * 인스턴스 변수 this.logTCPClient 에 대한 참조를 제거합니다.
       * @param options   fixme: {host, port}
       */
      (options) => {
        this.logTCPClient = null;
        console.error('[error] from Log Service : ', options);
      },
    );
    this.logTCPClient.connect();
  }

  /**
   * 로그 마이크로서비스로 기록할 로그 데이터를 전송합니다.
   * @param log   로그 데이터 버퍼
   */
  writeLog(log) {
    if (this.logTCPClient) {
      /*
      * 로그 마이크로서비스와 TCP 연결 상태일 때 실행합니다.
      * */
      const packet = {
        uri: '/logs',
        method: 'POST',
        key: 0,
        params: log,
      };
      this.logTCPClient.write(packet);
    } else {
      /*
      * 아직 로그 마이크로서비스에 연결된 상태가 아니라면,
      * 콘솔로 출력만 합니다.
      * */
      console.warn('[log not sent] not connected to Log Service. : ', log);
    }
  }
}

/*
* 준비된 TCP 서버 클래스를 다른 곳에서 불러다 사용할 수 있도록 내보냅니다.
* */
module.exports = TCPServer;
