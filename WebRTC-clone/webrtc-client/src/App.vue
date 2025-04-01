<script setup lang="ts">
// 服务端使用peer插件创建信令服务器  文档:https://www.npmjs.com/package/peer#create-a-custom-server
// 客户端使用peerjs插件简化P2P连接过程 PeerJS simplifies peer-to-peer data, video, and audio calls.  文档：https://peerjs.com/docs/#mediaconnection

import { onMounted, ref } from 'vue'
import { Peer } from 'peerjs'

const localVideo = ref<HTMLVideoElement>()
const remoteVideo = ref<HTMLVideoElement>()
const peer = ref<any>()
const peerId = ref('')

onMounted(() => {
  // 连接信令服务器
  peer.value = new Peer({
    host: 'localhost',
    port: 3001,
    path: '/myPeerServer'
  })
  // Every Peer object is assigned a random, unique ID when it's created.
  peer.value.on('open', (id: string) => {
    peerId.value = id
    console.log('My peer ID is: ' + id)
  })
})

const remoteId = ref('')
const caller = ref(false)
const called = ref(false)
const callObj = ref<any>()
const getLocalStream = async (constraints: MediaStreamConstraints) => {
  const stream = await navigator.mediaDevices.getUserMedia(constraints)
  localVideo.value!.srcObject = stream
  localVideo.value!.play()
  return stream
}
const callRemote = async () => {
  if (!remoteId.value) {
    alert('请输入对方ID')
    return
  }
  // 可配置媒体流选项 详情见API-https://developer.mozilla.org/zh-CN/docs/Web/API/MediaDevices/getUserMedia#constraints
  const mediaConstraints = { audio: true, video: true }
  // 获取本地流渲染到页面
  const stream = await getLocalStream(mediaConstraints)

  // 将本地媒体流发送给远程 Peer- Calls the remote peer specified by id and returns a media connection
  const call = peer.value.call(remoteId.value, stream)

  // 改变UI
  caller.value = true

  call.on('stream', (remoteStream: MediaStream) => {
    caller.value = false
    // 将对方的流渲染到页面
    remoteVideo.value!.srcObject = remoteStream
    remoteVideo.value!.play()
  })
}

const acceptCall = async () => {
  // B接收通话
  // 渲染本地流到页面
  const mediaConstraints = { audio: true, video: true }
  const stream = await getLocalStream(mediaConstraints)
  // B拿到A的流，渲染到页面
  callObj.value.answer(stream)
  // 获取对方流渲染到页面
  callObj.value.on('stream', (remoteStream: MediaStream) => {
    called.value = false
    remoteVideo.value!.srcObject = remoteStream
    remoteVideo.value!.play()
  })
}

const reset = () => {
  called.value = false
  caller.value = false
  localVideo.value!.srcObject = null
  remoteVideo.value!.srcObject = null
}

const hangUp = () => {}
</script>

<template>
  <div class="flex items-center flex-col text-center p-12 h-screen">
    <div class="relative h-full mb-4">
      <video ref="localVideo" class="w-96 h-full bg-gray-200 mb-4 object-cover"></video>
      <video ref="remoteVideo" class="w-32 h-48 absolute bottom-0 right-0 object-cover"></video>
      <input type="text" placeholder="输入接收方的peerId" v-model="remoteId" />
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
      <button
        class="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white"
        @click="hangUp">
        挂断视频
      </button>
    </div>
  </div>
</template>
