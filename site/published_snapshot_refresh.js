export function shouldAdoptPublishedSnapshot(current, next, requiredKey, clock='builtAt'){
  if(!next||typeof next!=='object'||!next[requiredKey]||typeof next[requiredKey]!=='object')return false;
  const incoming=Date.parse(next[clock]);
  if(!Number.isFinite(incoming)||incoming>Date.now()+60000)return false;
  const previous=Date.parse(current?.[clock]);
  return !Number.isFinite(previous)||incoming>previous;
}
