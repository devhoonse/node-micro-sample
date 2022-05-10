/*
* import : user-defined modules
* */
const TCPServer = require('./server');

/*
* 현재 연결되어 있는 모든 노드들의 정보를 이 객체에 관리합니다.
* todo: 관리 형식은 다음과 같습니다.
* Array<{
*   socket: TCP 소켓 객체,
*   info: {
*     name: TCP 클라이언트 이름,
*     port: TCP 클라이언트 서비스 포트,
*     urls: 처리 담당 URL 목록,
*     host: TCP 클라이언트 호스트명
*   },
* }>
* */
let map = {};

/*
* Distributor 서버 클래스입니다.
* TCPServer 클래스를 상속하여 구현하였습니다.
* 현재 네트워크 내에 연결된 노드 목록 정보를 동기화하는 역할을 하며,
* 자신이 관리하는 노드 목록을 브로드캐스팅 하는 역할을 합니다.
* ( 어떻게 보면 DHCP 처럼 비슷하게 동작한다고도 볼 수 있을 것 같음... )
* */
class Distributor extends TCPServer {

  /**
   * constructor
   * Distributor 서버가 TCP 서버 인스턴스로서 생성되고,
   * 바로 9000 번 포트로 TCP 서버가 시작됩니다.
   * 이 서버가 처리 가능한 작업명은 아래와 같이 2 가지 입니다.
   */
  constructor() {
    super("distributor", 9000, ["POST/distributes", "GET/distributes"]);
  }

  /**
   * 새 TCP 클라이언트와 연결될 때마다 실행할 메서드입니다.
   * 새 TCP 클라이언트에게
   * 현재 Distributor 에 연결되어 있는 모든 노드 정보 목록을 전송합니다.
   * @param socket  새 TCP 클라이언트와 연결된 소켓 객체
   */
  onCreate(socket) {
    super.onCreate(socket);
    this.sendInfo(socket);
  }

  /**
   * TCP 클라이언트와의 연결이 종료될 때마다 실행할 메서드입니다.
   * 연결된 모든 TCP 클라이언트 각각에게
   * 현재 Distributor 에 연결되어 있는 모든 노드 정보 목록을 브로드캐스팅 합니다.
   * @param socket  종료된 클라이언트와 연결된 소켓 객체
   */
  onClose(socket) {
    super.onClose(socket);

    /*
    * 연결이 종료된 노드의 정보를
    * 접속 중 노드 목록에서 제거해줍니다.
    * */
    const key = `${socket.remoteAddress}:${socket.remotePort}`;
    delete map[key];

    /*
    * Distributor 에 연결된 노드 목록의 변동이 발생하였으므로
    * 업데이트된 연결 목록을 다른 모든 노드들에게 브로드캐스팅합니다.
    * */
    this.sendInfo();
  }

  /**
   * TCP 클라이언트로부터 패킷을 수신할 때마다 실행할 메서드입니다.
   * Distributor 클래스의 경우, 패킷을 수신한다는 것은 곧
   * 새 노드를 네트워크에 신규 등록할 것을 요청하는 것을 의미합니다.
   * @param socket  패킷이 전송된 TCP 클라이언트와 연결된 소켓 객체
   * @param data    수신한 패킷 데이터 객체
   */
  onRead(socket, data) {
    super.onRead(socket, data);

    /*
    * 네트워크에 등록할 것을 요청받은 노드 정보를
    * 새로 노드 관리 목록에 등록합니다.
    * */
    const key = `${socket.remoteAddress}:${socket.remotePort}`;
    if (data.uri === "/distributes" && data.method === "POST") {
      map[key] = {
        socket,
        info: {
          ...data.params,
          host: socket.remoteAddress,
        },
      };

      /*
      * Distributor 에 연결된 노드 목록의 변동이 발생하였으므로
      * 업데이트된 연결 목록을 다른 모든 노드들에게 브로드캐스팅합니다.
      * */
      this.sendInfo();
    }
  }

  /**
   * 특정 TCP 클라이언트 노드로 패킷을 전송합니다.
   * @param socket  전송 대상 TCP 클라이언트와의 연결이 체결된 소켓 객체
   * @param packet  전송할 패킷 객체
   * */
  write(socket, packet) {
    socket.write(JSON.stringify(packet) + '¶');
  }

  /**
   * 현재 연결되어 있는 모든 TCP 클라이언트에게 정보를 브로드캐스팅 합니다.
   * @param socket  새 TCP 클라이언트와 연결된 소켓 객체이거나,
   *                혹은 null | undefined 일 수도 있는데,
   *                이는 어떤 TCP 클라이언트와의 연결이 해제된 상황에서 호출된 경우를 의미합니다.
   */
  sendInfo(socket) {

    /*
    * 각 노드로 브로드캐스팅할 데이터입니다.
    * Distributor -> 노드 방향 통신 프로토콜을 따릅니다.
    * */
    const packet = {
      uri: '/distributes',
      method: 'GET',
      key: 0,
      params: [],
    };

    /*
    * 현재 연결되어 있는 모든 TCP 클라이언트들의 정보를
    * packet.params 리스트로 정리합니다.
    * */
    for (let index in map) {
      packet.params.push(map[index].info);
    }

    /*
    * 준비된 패킷의 실제 발송 처리를 실행합니다.
    * */
    if (socket) {
      /*
      * 새 TCP 클라이언트에게
      * 현재 Distributor 에 연결되어 있는 모든 노드 정보 목록을 전송합니다.
      * */
      this.write(socket, packet);
    } else {
      /*
      * 연결된 모든 TCP 클라이언트 각각에게
      * 현재 Distributor 에 연결되어 있는 모든 노드 정보 목록을 브로드캐스팅 합니다.
      * */
      for (let index in map) {
        this.write(map[index].socket, packet);
      }
    }
  }
}

/*
* (Entry Point) Distributor 서버를 구동합니다.
* */
new Distributor();
