<script setup lang="ts">
// 1.静态
// 2.尝试把本地视频流渲染到页面（呼叫方/发起方）原生API- navigator.mediaDevices.getUserMedia
// 3.沟通的前提-通过信令服务器+P2P点对点连接交换信息-信息包含：媒体信息SDP以及网络信息candidate
// 4.建立交互逻辑 发起
//   4-1.建立后端服务-信令服务器（http + socket.io）
//   4-2 前端安装socket.io-client 连接信令服务器
//   4-3 共同沟通的前提-房间
//   4-4 获取本地音视频流-渲染到页面(赋值+play)
//   4-5 更改交互UI
//   4-6 通过信令服务器向B发起请求，注意向房间的所有人广播事件
//   4-7 B监听发起请求。改变B端UI状态

// 5.B接受请求
//   5-1.B向信令服务器发起通知，改变UI状态
//   5-2.信令服务器on B的接受，注意向房间的所有人广播事件
//   5-3.A监听B接受了请求，创建PeerConnection对象(P2P连接)，改变UI状态。最后发送一个offer给信令服务器
//   5-4.B监听A发送offer动作，创建自己的PeerConnection对象，本地流渲染、创建DSP信息（设置远端描述的offer、生成answer、创建本地描述的answer等）。最后发送一个answer给信令服务器
//   5-5.A监听B发送answer动作（信令服务器新建一个receiveAnswer动作），设置远端描述的answer

// 至此，媒体协商动作完成SDP信息交换  目的-双边编解码数据？ 调用了API createOffer + setLocalDescription + createAnswer + setRemoteDescription

// 开始交换网络信息candidate  目的？
// 6.A获取本地candidate信息并且通过信令服务器发送B
//  6-1.时机：监听到有人接受通话后，发送offer动作时。
// 7.B监听接收candidate信息，添加candiate信息 -addIceCandidate
// 8.B获取本地candidate信息，通过信令服务器发送给B
//   8-1.时机：监听到B接受通话后，发送answer动作时。
// 9.A添加B的candidate信息。代码同7，不用重复写

// 至此，candidate交换完成。开始P2P连接

// 10.接下来用户A和用户B就可以进行P2P通信流
// 10-1. 拿到对方的流-onaddstream API，渲染到自己的页面。
//    时机:A收到B触发的接收时，即'acceptCall'。B收到A发起时，即'sendOffer'。代码位置技巧：记住new RTCPeerConnection()的时机就行
//  也是：B接受了，A才把B的流渲染到自己的页面上。这时候B页面也应该出现A的流。可以借助A 监听B接收 时，发出Offer的动作里面 做B渲染A的流到自己页面。

// 总结每个交互动作都需要：emit + on。通过信令服务器来沟通触发动作
import { onMounted, ref } from 'vue'
import { io, type Socket } from 'socket.io-client'

const localVideo = ref<HTMLVideoElement>()
const remoteVideo = ref<HTMLVideoElement>()
// 定义socket实例
const socket = ref<Socket>()
// 创建房间
const roomId = '001'
const peer = ref<any>()
const localStream = ref<MediaStream>()
// UI交互中间状态
const calling = ref(false)
const caller = ref(false) // 呼叫者标识
const called = ref(false) // 被呼叫着标识
const communicating = ref(false) // 通话中

const getLocalStream = async () => {
  // 获取本地音视频流
  const stream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
  })
  // 将流设置到 video 标签上播放
  localVideo.value!.srcObject = stream
  localVideo.value!.play()
  // 将本地流存起来，P2P连接需要添加流
  localStream.value = stream
  return stream
}

onMounted(async () => {
  // 2.尝试把本地视频流渲染到页面
  // getLocalStream()

  // 3.连接信令服务器
  const sock = io('localhost:3000') // 对应服务的端口
  sock.on('connectionSuccess', () => {
    // console.log('client connect success')
    // 加入房间
    sock.emit('joinRoom', roomId)

    // B监听收到通话请求事件
    sock.on('receiveCall', (roomId) => {
      // 如果是B（被呼叫者）才做以下动作
      if (!caller.value) {
        calling.value = true
        called.value = true
      }
    })

    // A监听所有人接受了通话请求事件
    sock.on('acceptCall', async () => {
      // 创建P2P连接，success则UI更新成通话中的状态
      if (caller.value) {
        // 创建RTCPeerConnection对象 原生API
        peer.value = new RTCPeerConnection()
        // 添加本地音视频流
        peer.value.addStream(localStream.value)

        // 获取candidate信息
        peer.value.onicecandidate = (event: any) => {
          if (event.candidate) {
            // 向服务器发送candidate信息
            sock.emit('sendCandidate', { roomId, candidate: event.candidate })
          }
        }
        // 开始P2P连接
        peer.value.onaddstream = (event: any) => {
          // console.log(event, 'onaddstream-A页面拿到B的流')
          // 更改UI
          calling.value = false
          communicating.value = true
          // 拿到对方视频流
          remoteVideo.value!.srcObject = event.stream
          remoteVideo.value!.play()
        }

        // 生成offer 开始交换SDP信息（媒体协商过程）
        const offer = await peer.value.createOffer({
          offerToReceiveAudio: 1,
          offerToReceiveVideo: 1,
        })
        // console.log(offer, 'offer')
        // 设置本地描述的offer
        await peer.value.setLocalDescription(offer)
        // 通过信令服务器将offer信息发送给B
        sock.emit('sendOffer', { offer, roomId })
      }
    })

    // B监听发送offer事件
    sock.on('sendOffer', async (offer) => {
      if (called.value) {
        // console.log('sendOffer', offer)
        // B接收者创建自己的本地流并添加流
        const stream = await getLocalStream()
        // 创建自己的RTCPeerConnection对象
        peer.value = new RTCPeerConnection()
        // 添加本地流
        peer.value.addStream(stream)

        // 获取candidate信息
        peer.value.onicecandidate = (event: any) => {
          if (event.candidate) {
            // 向服务器发送candidate信息
            sock.emit('sendCandidate', { roomId, candidate: event.candidate })
          }
        }
        // 开始P2P连接-添加对方流渲染到页面
        peer.value.onaddstream = (event: any) => {
          // 更改UI
          calling.value = false
          communicating.value = true
          // 拿到对方视频流
          remoteVideo.value!.srcObject = event.stream
          remoteVideo.value!.play()
        }

        // 设置远端描述的offer
        await peer.value.setRemoteDescription(offer)
        // 生成answer
        const answer = await peer.value.createAnswer()
        // console.log(answer, 'answer')
        // 设置本地描述的answer
        await peer.value.setLocalDescription(answer)
        // 发送answer给信令服务器
        sock.emit('sendAnswer', { answer, roomId })
      }
    })

    // A监听收到answer事件
    sock.on('receiveAnswer', (answer: any) => {
      if (caller.value) {
        // 设置远端描述的answer
        // console.log(answer, 'receiveAnswer')
        peer.value.setRemoteDescription(answer)
      }
    })
    // B监听发送candidate事件
    sock.on('receiveCandidate', async (candidate: any) => {
      // console.log('B收到candidate')
      await peer.value.addIceCandidate(candidate)
    })
    // 两边监听挂断事件，重置状态
    sock.on('hangUp', () => {
      // console.log('hangUp')
      reset()
    })
  })
  socket.value = sock
})

const callRemote = async () => {
  if (calling.value || communicating.value) {
    return
  }
  // ！发起视频前要先创建好房间
  caller.value = true
  calling.value = true
  await getLocalStream()
  // 发给信令服务器告诉B 已经发起了请求，并告诉房间号信息
  socket.value?.emit('callRemote', roomId)
}
const acceptCall = () => {
  // 接听
  socket.value?.emit('acceptCall', roomId)
}
const hangUp = () => {
  // 重置很多状态-reset函数 两边都需要重置状态，所以需要发送给信令服务器去广播，页面监听挂断事件执行
  // calling.value = false
  socket.value?.emit('hangUp', roomId)
}
const reset = () => {
  caller.value = false
  called.value = false
  calling.value = false
  communicating.value = false
  peer.value = null
  localVideo.value!.srcObject = null
  remoteVideo.value!.srcObject = null
  localStream.value?.getTracks()[0].stop()
  // localStream.value = undefined
}
</script>

<template>
  <div class="flex items-center flex-col text-center p-12 h-screen">
    <div class="relative h-full mb-4">
      <video ref="localVideo" class="w-96 h-full bg-gray-200 mb-4 object-cover"></video>
      <video ref="remoteVideo" class="w-32 h-48 absolute bottom-0 right-0 object-cover"></video>
      <!-- 中间过渡提示 -->
      <!-- 发起时，呼叫方状态 -->
      <div v-if="caller && calling" class="absolute top-2/3 left-36 flex flex-col items-center">
        <p class="mb-4 text-white">等待对方接听...</p>
        <img @click="hangUp" src="/refuse.svg" class="w-16 cursor-pointer" alt="" />
      </div>
      <!-- 发起时，接收者（被呼叫方）状态 什么时候触发 收到A的请求信息才显示-->
      <div v-if="called && calling" class="absolute top-2/3 left-32 flex flex-col items-center">
        <p v class="mb-4 text-white">收到视频邀请...</p>
        <div class="flex">
          <img @click="hangUp" src="/refuse.svg" class="w-16 cursor-pointer mr-4" alt="" />
          <img @click="acceptCall" src="/accept.svg" class="w-16 cursor-pointer" alt="" />
        </div>
      </div>
    </div>
    <div class="flex gap-2 mb-4">
      <button
        v-if="!calling && !communicating"
        class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
        @click="callRemote">
        发起视频
      </button>
      <button class="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white" @click="hangUp">挂断视频</button>
    </div>
  </div>
</template>
