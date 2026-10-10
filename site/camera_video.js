export function publicRoadVideoAgency(item){
  const url=item?.videoUrl||'';
  const caltrans=item?.id?.match(/^caltrans-([47])-\d{1,6}$/);
  if(item?.agency==='Caltrans'&&item?.inService===true&&caltrans&&new RegExp(`^https://wzmedia\\.dot\\.ca\\.gov/D${caltrans[1]}/[A-Za-z0-9_-]+\\.stream/playlist\\.m3u8$`).test(url))return 'Caltrans';
  if(item?.agency==='WisDOT 511'&&/^https:\/\/cctv\d+\.dot\.wi\.gov\/rtplive\/CCTV-\d{2}-\d{4}\/playlist\.m3u8$/.test(url))return 'WisDOT';
  if(item?.agency==='MnDOT IRIS'&&/^mndot-C\d{1,6}$/.test(item.id||'')&&url===`https://video.dot.state.mn.us/public/${item.id.slice(6)}.stream/playlist.m3u8`)return 'MnDOT';
  if(item?.agency==='NJTA'&&/^njta-\d{1,6}$/.test(item.id||'')&&/^https:\/\/wink\.njta\.com\/\d{1,4}\/public\/hls\/[A-Za-z0-9-]+_nj\.m3u8$/.test(url))return 'NJTA';
  if(item?.agency==='TDOT SmartWay'&&item?.inService===true&&/^tdot-smartway-\d{1,6}$/.test(item.id||'')&&/^https:\/\/mcleansfs[1-9]\d*\.us-east-1\.skyvdn\.com\/rtplive\/R3_\d{3}\/playlist\.m3u8$/.test(url))return 'TDOT SmartWay';
  return null;
}
