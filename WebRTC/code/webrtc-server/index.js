const socket = require('socket.io');
const http = require('http');

const server = http.createServer()

const io = socket(server, {
  cors: {
    origin: '*' // 配置跨域
  }
});

io.on('connection', sock => {
  console.log('连接成功...')

  // 向客户端发送连接成功的消息
  sock.emit('connectionSuccess');

  // 监听客户端进入房间的事件
  sock.on('joinRoom', (roomId) => {
    // 加入房间
    sock.join(roomId)
  })

  // 收到发送方的视频请求事件
  sock.on('callRemote', roomId => {
    // 向这个房间中的人广播这个事件
    io.to(roomId).emit('receiveCall')
  })

  // 收到接收方的同意视频事件
  sock.on('acceptCall', roomId => {
    // 向这个房间中的人广播这个事件
    io.to(roomId).emit('acceptCall')
  })

  // 收到发送方的offer
  sock.on('sendOffer', ({ roomId, offer }) => {
    // 向接收方发送这个offer
    io.to(roomId).emit('sendOffer', offer)
  })

  // 收到接收方的answer
  sock.on('sendAnswer', ({ roomId, answer }) => {
    // 向这个房间中的人广播这个事件
    io.to(roomId).emit('receiveAnswer', answer)
  })

  // 收到发送方的candidate信息
  sock.on('sendCandidate', ({ roomId, candidate }) => {
    // 向这个房间中的人广播candidate信息
    io.to(roomId).emit('receiveCandidate', candidate)
  })

  // 收到挂断视频请求
  sock.on('hangUp', roomId => {
    // 向这个房间中的人广播这个事件
    io.to(roomId).emit('hangUp')
  })
})

server.listen(3001, () => {
  console.log('服务器启动成功');
});