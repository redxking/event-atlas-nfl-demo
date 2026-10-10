export function publicRoadVideoAgency(item){
  const url=item?.videoUrl||'';
  if(item?.agency==='WisDOT 511'&&/^https:\/\/cctv\d+\.dot\.wi\.gov\/rtplive\/CCTV-\d{2}-\d{4}\/playlist\.m3u8$/.test(url))return 'WisDOT';
  if(item?.agency==='MnDOT IRIS'&&/^mndot-C\d{1,6}$/.test(item.id||'')&&url===`https://video.dot.state.mn.us/public/${item.id.slice(6)}.stream/playlist.m3u8`)return 'MnDOT';
  return null;
}
