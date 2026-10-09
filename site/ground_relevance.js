export function pointInsideRing(point,ring){
  if(!Number.isFinite(point?.lat)||!Number.isFinite(point?.lon)||!Array.isArray(ring)||ring.length<4)return false;
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j];
    if((a[1]>point.lat)!==(b[1]>point.lat)&&point.lon<(b[0]-a[0])*(point.lat-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}
