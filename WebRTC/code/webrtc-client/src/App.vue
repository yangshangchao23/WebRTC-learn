<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { io, Socket } from "socket.io-client";

const roomId = '001' // 房间ID

const called = ref<boolean>(false) // 是否是接收方
const caller = ref<boolean>(false) // 是否是发起方
const calling = ref<boolean>(false) // 呼叫中
const communicating = ref<boolean>(false) // 视频通话中
const localVideo = ref<HTMLVideoElement>() // video标签实例，播放本人的视频
const remoteVideo = ref<HTMLVideoElement>() // video标签实例，播放对方的视频
const localStream = ref<MediaStream>() // 本地流
const socket = ref<Socket>() // Socket实例
const peer = ref<any>() // RTCPeerConnection实例

onMounted(() => {
  const sock = io('localhost:3001'); // 对应服务的端口

  // 连接成功
  sock.on('connectionSuccess', () => {
    // 进入房间
    sock.emit('joinRoom', roomId);
  });

  // 接收方监听收到视频请求事件
  sock.on('receiveCall', () => {
    if (!caller.value) {
      calling.value = true
      called.value = true;
    }
  })

  // 发送方收到同意视频事件
  sock.on('acceptCall', async () => {
    if (caller.value) { // 发送方
      // 创建RTCPeerConnection对象
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

      peer.value.onaddstream = (event: any) => {  
        calling.value = false   
        communicating.value = true
        // 拿到对方的视频流
        remoteVideo.value!.srcObject = event.stream;
        remoteVideo.value!.play()
      };

      // 生成offer
      const offer = await peer.value.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      })
      // 设置本地描述的offer
      await peer.value.setLocalDescription(offer);
      // 发送offer
      sock.emit('sendOffer', { roomId, offer });
    }
  })

  // 接收方收到offer
  sock.on('sendOffer', async (offer: any) => {
    if (called.value) {
      const stream = await getLocalStream()

      // 接收方创建自己的RTCPeerConnection对象
      peer.value = new RTCPeerConnection();

      // 添加本地音视频流
      peer.value.addStream(stream);

      // 获取candidate信息
      peer.value.onicecandidate = (event: any) => {
        if (event.candidate) {          
          // 向服务器发送candidate信息
          sock.emit('sendCandidate', { roomId, candidate: event.candidate })
        }
      }

      // 获取对方的音视频流
      peer.value.onaddstream = (event: any) => {                
        // 拿到对方的视频流
        calling.value = false
        communicating.value = true
        remoteVideo.value!.srcObject = event.stream;
        remoteVideo.value!.play()
      };

      // 设置远端描述信息
      await peer.value.setRemoteDescription(offer);

      // 生成answer
      const answer = await peer.value.createAnswer()
      // 设置本地描述信息
      await peer.value.setLocalDescription(answer);
      // 发送answer
      sock.emit('sendAnswer', { roomId, answer });
    }
  })

  // 发送方收到接收方的answer
  sock.on('receiveAnswer', (answer: any) => {
    if (caller.value) {
      // 设置远端描述信息
      peer.value.setRemoteDescription(answer);
    }
  })

  // 接收candidate信息
  sock.on('receiveCandidate', async (candidate: any) => {
    await peer.value.addIceCandidate(candidate);
  })

  // 收到挂断视频请求
  sock.on('hangUp', () => {
    reset()
  })

  socket.value = sock
})

// 获取本地音视频流
const getLocalStream = async () => {
  // 获取音视频流
  const stream = await navigator.mediaDevices.getUserMedia({
    video: true, 
    audio: true 
  })
  // 将媒体流设置到 video 标签上播放
  localVideo.value!.srcObject = stream
  // 播放音视频流
  localVideo.value!.play()
  // 存储本地流
  localStream.value = stream

  return stream
}

// 发起视频请求（发起方）
const callRemote = async () => {
  if (calling.value || communicating.value) {
    return
  }
  calling.value = true
  // 获取本地音视频流
  await getLocalStream()

  // 向服务器发送发起视频请求的事件
  caller.value = true
  socket.value.emit('callRemote', roomId)
}

// 接收视频请求（接受方）
const acceptCall = () => {
  // 向服务器发送接受视频请求的事件
  socket.value.emit('acceptCall', roomId)
}

// 挂断视频
const hangUp = () => {
  socket.value.emit('hangUp', roomId)
}

// 状态重置
const reset = () => {
  called.value = false
  caller.value = false
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
      <video
        ref="localVideo" 
        class="w-96 h-full bg-gray-200 mb-4 object-cover"
      ></video>
      <video
        ref="remoteVideo"
        class="w-32 h-48 absolute bottom-0 right-0 object-cover"
      ></video>
      <div v-if="caller && calling" class="absolute top-2/3 left-36 flex flex-col items-center">
        <p class="mb-4 text-white">等待对方接听...</p>
        <img @click="hangUp" src="/refuse.svg" class="w-16 cursor-pointer" alt="">
      </div>
      <div v-if="called && calling" class="absolute top-2/3 left-32 flex flex-col items-center">
        <p class="mb-4 text-white">收到视频邀请...</p>
        <div class="flex">
          <img @click="hangUp" src="/refuse.svg" class="w-16 cursor-pointer mr-4" alt="">
          <img @click="acceptCall" src="/accept.svg" class="w-16 cursor-pointer" alt="">
        </div>
      </div>
    </div>
    <div class="flex gap-2 mb-4">
      <button class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white" @click="callRemote">发起视频</button>
      <button class="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white" @click="hangUp">挂断视频</button>
    </div>
  </div>
</template>

<style scoped>
</style>