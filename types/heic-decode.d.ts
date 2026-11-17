declare module 'heic-decode' {
 type Frame={width:number;height:number;decode():Promise<{width:number;height:number;data:Uint8ClampedArray}>};
 type Frames=Frame[]&{dispose():void};
 const decode:{all(input:{buffer:Uint8Array}):Promise<Frames>};
 export default decode;
}
