import {Component,Suspense,useEffect,useMemo,useRef} from 'react'
import {Canvas,useFrame,useLoader} from '@react-three/fiber'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import {CanvasTexture, MeshBasicMaterial, SRGBColorSpace, TextureLoader} from 'three'
import {yawForPointer,pitchForPointer} from './helmet-motion'
import {detailBox,helmetOutline,heroImage} from './helmet-detail'

class Fallback extends Component {
  state={failed:false}
  static getDerivedStateFromError(){return {failed:true}}
  componentDidCatch(){this.props.onError()}
  render(){return this.state.failed?null:this.props.children}
}

// Project the sharper original helmet onto the front of the GLB. Its own
// texture remains visible on the sides as the fitted mesh turns.
function makePhotoMap(image) {
  const {x,y,width,height}=detailBox
  const canvas=document.createElement('canvas')
  canvas.width=width*2
  canvas.height=height*2
  const ctx=canvas.getContext('2d')
  ctx.scale(2,2)
  ctx.translate(-x,-y)
  ctx.clip(new Path2D(helmetOutline))
  ctx.imageSmoothingQuality='high'
  ctx.drawImage(image,0,0)
  const map=new CanvasTexture(canvas)
  map.colorSpace=SRGBColorSpace
  map.anisotropy=4
  return map
}
function createMaterial(baseMap,photoMap){
  const mat=new MeshBasicMaterial({map:baseMap,toneMapped:false})
  mat.onBeforeCompile=shader=>{
    shader.uniforms.helmetPhoto={value:photoMap}
    shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
      varying vec3 detailPosition;
      varying vec3 detailNormal;
    `).replace('#include <begin_vertex>',`#include <begin_vertex>
      detailPosition = position;
      detailNormal = normal;
    `)
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
      uniform sampler2D helmetPhoto;
      varying vec3 detailPosition;
      varying vec3 detailNormal;
    `).replace('#include <map_fragment>',`#include <map_fragment>
      vec2 photoPx = vec2(839.4 + detailPosition.x * 264.8, 450.1 - detailPosition.y * 264.8);
      vec2 photoUV = (photoPx - vec2(700.0,175.0)) / vec2(280.0,300.0);
      vec4 detail = texture2D(helmetPhoto,vec2(photoUV.x,1.0-photoUV.y));
      float facing = smoothstep(0.22,0.66,normalize(detailNormal).z);
      float front = smoothstep(-0.10,0.30,detailPosition.z);
      diffuseColor.rgb = mix(diffuseColor.rgb,detail.rgb,smoothstep(0.15,0.98,detail.a)*facing*front);
    `)
  }
  return mat
}
function Helmet({pointer,onReady}) {
  const {scene}=useLoader(GLTFLoader,'/media/orbitone-helmet.glb')
  const photo=useLoader(TextureLoader,heroImage)
  const pivot=useRef()
  const painted=useRef(false)
  const {object,materials,photoMap}=useMemo(()=>{
    const object=scene.clone(true)
    const photoMap=makePhotoMap(photo.image)
    const materials=[]
    object.traverse(mesh=>{
      if(!mesh.isMesh)return
      mesh.material=createMaterial(mesh.material.map,photoMap)
      materials.push(mesh.material)
    })
    return {object,materials,photoMap}
  },[scene,photo])
  useEffect(()=>()=>{materials.forEach(mat=>mat.dispose());photoMap.dispose();onReady(false)},[materials,photoMap,onReady])
  useFrame(({gl},dt)=>{
    const p=pivot.current
    if(!p)return
    const blend=1-Math.exp(-5.2*Math.min(dt,.08))
    p.rotation.y+=(yawForPointer(pointer.current.x)-p.rotation.y)*blend
    p.rotation.x+=(pitchForPointer(pointer.current.y)-p.rotation.x)*blend
    p.rotation.z+=(-pointer.current.x*.027-p.rotation.z)*blend
    gl.domElement.dataset.yaw=p.rotation.y.toFixed(3)
    gl.domElement.dataset.pitch=p.rotation.x.toFixed(3)
    if(!painted.current){painted.current=true;onReady(true)}
  })
  return <group ref={pivot} position={[0,-.37,0]}><primitive object={object} position={[0,-.13,0]}/></group>
}
export default function LiveHelmet({pointer,onReady,onError}) {
  return <Fallback onError={onError}><Canvas flat orthographic dpr={[1,2]} camera={{position:[0,0,4],zoom:1}} gl={{alpha:true,antialias:true}}>
    <ScaleScene/>
    <Suspense fallback={null}><Helmet pointer={pointer} onReady={onReady}/></Suspense>
  </Canvas></Fallback>
}
function ScaleScene(){
  useFrame(({camera,size})=>{
    const zoom=size.height/1.16
    if(camera.zoom!==zoom){camera.zoom=zoom;camera.updateProjectionMatrix()}
  })
  return null
}
