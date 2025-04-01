// 使用peer搭建信令服务器
const { PeerServer } = require('peer')
const peerServer = PeerServer({ port: 3001, path: '/myPeerServer' })
