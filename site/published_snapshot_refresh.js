export function validPublishedSnapshotValue(next,requiredKey,kind='object'){
  if(!next||typeof next!=='object')return false;
  const value=next[requiredKey];
  return kind==='nonnegative_integer'?Number.isSafeInteger(value)&&value>=0:!!value&&typeof value==='object';
}

export function shouldAdoptPublishedSnapshot(current, next, requiredKey, clock='builtAt',kind='object'){
  if(!validPublishedSnapshotValue(next,requiredKey,kind))return false;
  const incoming=Date.parse(next[clock]);
  if(!Number.isFinite(incoming)||incoming>Date.now()+60000)return false;
  const previous=Date.parse(current?.[clock]);
  return !Number.isFinite(previous)||incoming>previous;
}
