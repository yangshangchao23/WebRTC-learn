const socket = require('socket.io')
const http = require('http')
const server = http.createServer()

const io = socket(server, {
  cors: { origin: '*' }
})

io.on('connection', socket => {
  console.log('server connect success')
  // 通知客户端
  socket.emit('connectionSuccess')
  // 监听房间创建信息
  socket.on('joinRoom', roomId => {
    console.log('joinRoom', roomId)
    // 加入房间
    socket.join(roomId)
  })
  // 监听发起通话请求
  socket.on('callRemote', roomId => {
    // 触发一个收到请求事件-向这个房间中的所有人广播这个事件
    io.to(roomId).emit('receiveCall')
  })
  // 监听接受通话请求
  socket.on('acceptCall', roomId => {
    // 向这个房间中的所有人广播这个事件
    io.to(roomId).emit('acceptCall')
  })
  // 监听发起者的发送offer事件
  socket.on('sendOffer', ({ offer, roomId }) => {
    // 广播发送offer事件给接收者
    io.to(roomId).emit('sendOffer', offer)
  })

  // 监听接收者的发送answer事件
  socket.on('sendAnswer', ({ answer, roomId }) => {
    // A要接收answer 广播receiveAnswer给发起者
    io.to(roomId).emit('receiveAnswer', answer)
  })
})

server.listen(3000, () => {
  console.log('server is running at 3000')
})
