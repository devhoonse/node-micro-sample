
/*
* import : built-ins
* */
const http = require('http');
const url = require('url');
const querystring = require('querystring');

/*
* import : user-defined modules
* */
const TCPClient = require('./client');


/*
* fixme: 게이트웨이 측에서 관리하는
* */
let mapClients = {};    // 호스트명:포트 -> { TCPClient , info }
let mapUrls = {};       // 작업명 -> 마이크로서비스 노드의 목록
let mapResponse = {};
let mapRR = {};
let index = 0;


/*
* 서버 인스턴스입니다.
 - 서비스 포트 : 8000
* */
const server = http.createServer(
  /**
   * 서버로 요청이 들어왔을 때 처리할 작업입니다.
   *    @param req request 객체
   *    @param res response 객체
   */
  (req, res) => {
    /*
    * 1. 우선 요청받은 자원이 무엇인지를 파악합니다.
    * */
    const method = req.method;
    const uri = url.parse(req.url, true);
    const pathname = uri.pathname;

    /*
    * 2. 요청받은 내용에 따라 다른 일을 하도록 분기처리 합니다.
    * */
    if (method === 'POST' || method === "PUT") {
      /*
      * 2-1. method : POST , PUT
      * */

      /*
      * 2-1-1. 클라이언트로부터 버퍼 패킷을 전송받을 때마다 body 에 붙여줌으로써
      *        클라이언트로부터 전송받은 전체 메세지를 파악합니다.
      * */
      let body = "";
      req.on('data', (data) => {
        body += data;
      });

      /*
      * 2-1-2. 클라이언트로부터 버퍼 패킷을 모두 수신했을 때 실행할 동작입니다.
      * */
      req.on('end', () => {

        /*
        * 2-1-2-1. params 변수에 매개변수 객체를 담습니다.
        *          HTTP 요청문의 헤더 내용 중 content-type 값에 따라 오는 방법이 달라지므로
        *          파악을 위한 파싱 방법이 구분됩니다.
        * */
        let params;
        if (req.headers['content-type'] === "application/json") {
          params = JSON.parse(body);
        } else {
          params = querystring.parse(body);
        }

        /*
        * 2-1-2-2. 요청받은 작업 내용을 수행하는 함수를 호출합니다.
        *          이 때, 해야 할 작업 내용이 무엇인지 전달합니다.
        * */
        onRequest(res, method, pathname, params);
      });

    } else {
      /*
      * 2-2. method : POST , PUT 이외에 GET , DELETE , 등등
      * */

      /*
      * 2-2-1. 클라이언트로
      *        2-1-1 과 달리 uri.query 를 통해 한 번에 접근 가능하기 때문에
      *        매개변수 파악을 위한 별도의 파싱 과정이 필요 없으므로
      *        2-1-2-1. 과 같은 파싱 로직이 없습니다.
      *        uri.query 객체를 onRequest() 함수에게 바로 전달합니다.
      * */
      onRequest(res, method, pathname, uri.query);
    }
  }
).listen(8000,
  /**
   * 서버가 서비스 포트에 성공적으로 할당된 후에 실행될 콜백 함수입니다.
   * ( TCPServer 클래스의 connectToDistributor() 메서드의 코드와 동일합니다. )
   * */
  () => {
    console.log('[start] serving on : ', server.address());

    /*
    * Distributor 서버에 연결될 때마다
    * Distributor 서버 측에 보낼 패킷입니다.
    * */
    const packet = {
      uri: '/distributes',
      method: 'POST',
      key: 0,
      params: {
        port: 8000,
        name: "gate",
        urls: [],
      },
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
      '127.0.0.1',
      9000,
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
        onDistribute(data);
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
);

/**
 * Distributor 서버로부터 데이터 수신 시 실행할 함수입니다.
 * 이 데이터는, Distributor 에 연결된 마이크로서비스 노드들의 접속 정보 및 이용 가능 상태 목록입니다.
 * 새로운 마이크로서비스 노드별 상태 목록을 받아서
 * 게이트웨이 측에서 관리하는 자신과 각 노드와의 연결 및 연결 상태를 갱신하기 위함입니다.
 * @param data  Distributor 서버로부터 수신한 마이크로서비스 노드 목록 데이터
 *              (Distributor 클래스의 sendInfo(socket) 메서드를 통해 발송된 데이터입니다.)
 */
function onDistribute(data) {

  /*
  * 목록에 담겨 있는 각 마이크로서비스 노드들에 대해 실행합니다.
  * */
  for (let index in data.params) {

    /*
    * 각 마이크로서비스 노드들에 대한 기본 정보입니다.
    * */
    const node = data.params[index];
    const key = `${node.host}:${node.port}`;

    /*
    * 처리 대상에서 제외해야 합니다.
    * - 노드의 이름이 "gate" 인 것은 게이트웨이 자기 자신에 대한 정보이므로 연결할 필요가 없습니다.
    * - 이미 연결된 TCPClient 객체가 있는 경우 다시 연결할 필요가 없습니다.
    * */
    if (mapClients[key] === undefined && node.name !== "gate") {

      /*
      * 마이크로서비스 노드로 TCP 연결을 하기 위한 접속 정보를 설정합니다.
      * */
      const client = new TCPClient(node.host, node.port,
        onCreateClient, // 접속 완료 시 실행할 콜백 함수
        onReadClient,   // 데이터 수신 시 실행할 콜백 함수
        onEndClient,    // 접속 종료 이벤트에서 실행할 콜백 함수
        onErrorClient   // 에러 발생 이벤트에서 실행할 콜백 함수
      );

      /*
      * 게이트웨이 쪽에서 관리하는 mapClients 리스트에서
      * 해당 마이크로서비스 노드로의 접속 상태를 업데이트 합니다.
      * */
      mapClients[key] = {
        client,
        info: node,
      };

      /*
      * 마이크로서비스 노드가 처리 가능한 작업명 목록들을 조회하여
      * mapUrls 의 상태를 업데이트 합니다.
      *   마이크로서비스 노드의 처리 가능 작업명 목록
      *     - microNode -> [j1, j2, j3, ...]
      *   mapUrls 로 정리
      *     - j1 -> mapUrls[j1] + [microNode]
      *     - j2 -> mapUrls[j2] + [microNode]
      *     - j3 -> mapUrls[j3] + [microNode]
      *     - ...
      * */
      for (let index in node.urls) {
        const key = node.urls[index]; // 마이크로서비스 노드가 처리 가능한 작업명 입니다.
        if (mapUrls[key] === undefined) {
          mapUrls[key] = [];
        }
        mapUrls[key].push(client);
      }

      /*
      * 마이크로서비스 노드와의 TCP 연결을 시도합니다.
      * */
      client.connect();
    }
  }
}

/**
 * 개별 마이크로서비스 노드와의 접속 완료 시 실행할 콜백 함수
 * @param options 접속 정보
 */
function onCreateClient(options) {
  console.log('[connected] to micro node : ', options);
}

/**
 * 개별 마이크로서비스 노드로부터 데이터 수신 시 실행할 콜백 함수
 * 즉, 마이크로서비스 노드가 게이트웨이에게 요청받은 작업을 완료하고
 * 응답을 전송한 상황입니다.
 * @param options 접속 정보
 * @param packet  수신한 데이터 패킷
 */
function onReadClient(options, packet) {
  /*
  * 우선, 로그를 출력합니다.
  * */
  console.group('[received]');
  console.log('from : ', options);
  console.log('packet : ', packet);
  console.groupEnd();

  /*
  * 마이크로서비스 노드에서 도착한 작업 완료 내용 패킷을
  * JSON 형식 문자열로 변환하여
  * 게이트웨이에 요청한 클라이언트에게 전달합니다.
  * */
  mapResponse[packet.key].writeHead(200, {
    'Content-Type': 'application/json',
  });
  mapResponse[packet.key].end(JSON.stringify(packet));

  /*
  * 응답을 완료했음을 로그로 출력합니다.
  * */
  console.group('[sent]');
  console.log('to : ', mapResponse[packet.key]);
  console.log('packet : ', packet);
  console.groupEnd();

  /*
  * 클라이언트 요청에 대한 처리가 모두 마무리 되었으므로,
  * 해당 클라이언트에 대한 response 객체를 제거합니다.
  * */
  delete mapResponse[packet.key];
}

/**
 * 개별 마이크로서비스 노드와의 접속 종료 이벤트에서 실행할 콜백 함수
 * @param options 접속 정보
 */
function onEndClient(options) {
  const key = `${options.host}:${options.port}`;

  /*
  * mapUrls 객체에서 관리하던 작업명 목록 중
  * 해당 마이크로서비스 노드에서 처리할 수 있던 작업들에 대해
  * 각각의 리스트에서 해당 노드 정보만 제거합니다.
  * */
  for (let index in mapClients[key].info.urls) {
    const jobName = mapClients[key].info.urls[index];
    mapUrls[jobName] = mapUrls[jobName].filter(
      (node) => node !== mapClients[key].client
    );
  }

  /*
  * mapClients 객체에서 마이크로서비스 노드 관리 정보를 제거합니다.
  * */
  delete mapClients[key];
}

/**
 * 개별 마이크로서비스 노드와의 에러 발생 이벤트에서 실행할 콜백 함수
 * @param options 접속 정보
 */
function onErrorClient(options) {
  console.group('[error]');
  console.log('from : ', options);
  console.groupEnd();
}

/**
 * API 비즈니스 로직을 처리합니다.
 * 클라이언트로부터 요청받은 작업명을 파악하여
 * 이를 처리할 수 있는 마이크로서비스 노드로 작업 요청을 보냅니다.
 * @param res       response 객체
 * @param method    요청받은 메서드
 * @param pathname  요청받은 자원명
 * @param params    함께 전달받은 매개변수 데이터
 */
function onRequest(res, method, pathname, params) {

  /*
  * 요청받은 작업명을 파악합니다.
  * */
  const key = method + pathname;

  /*
  * 게이트웨이에 연결된 마이크로서비스 노드들 중,
  * 요청받은 작업명을 처리할 수 있는 노드가 있는 지 확인합니다.
  * */
  const clients = mapUrls[key];
  if (clients === undefined) {
    /*
    * 요청받은 작업명을 처리할 수 있는 노드가 없는 경우,
    * 클라이언트로 HTTP 404 상태코드를 응답합니다.
    * */
    res.writeHead(404);
    return res.end();
  } else {
    /*
    * 요청받은 작업명을 처리할 수 있는 노드들이 있습니다.
    * 이 블록은, 그들 중 어떤 노드에게 작업을 할당할 지 결정하는 로직입니다.
    * */

    /*
    * 해당 마이크로서비스를 호출하기 전에 고유한 키를 발급하는데,
    * 이 고유한 키를 패킷에 담아 전달하기 위해 params.key 에 담습니다.
    * */
    params.key = index;

    /*
    * 마이크로서비스 노드에게 전송할 작업 요청 내용을 담은 패킷입니다.
    * */
    const packet = {
      uri: pathname,
      method,
      params,
    };

    /*
    * 우선 요청을 보낸 클라이언트에 대한 응답 객체를 담아 둡니다.
    * 그리고, 다음 요청이 들어올 때를 대비하여
    * 키의 유일성을 보장하기 위해 고유한 키의 값을 1 증가시켜 둡니다.
    * */
    mapResponse[index] = res;
    index++;

    /*
    * 요청받은 작업명을 처리할 수 있는 여러 마이크로서비스 노드들 중,
    * 일부에 요청이 집중되는 것을 방지하고 각각에 고르게 분배하기 위해
    * 라운드 로빈 방식을 구현합니다.
    * 이를 위해 인덱스 값을 1 증가시킵니다.
    * */
    if (mapRR[key] === undefined) {
      mapRR[key] = 0;
    }
    mapRR[key]++;

    /*
    * 결졍된 마이크로서비스 노드에게 작업 요청 패킷을 전송합니다.
    * */
    clients[mapRR[key] % clients.length].write(packet);

  }
}

