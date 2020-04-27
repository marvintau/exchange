
function sumCode(children, fieldName='ref'){
  const result = children.some(({[fieldName]:{code}}) => code !== 'NORM') ? 'WARN' : 'NORM';
  return result;
}

function sumResult(children, fieldName='ref'){
  const result = children
    .reduce((acc, {[fieldName]:{result}}) => acc + (!isNaN(result) ? result: 0), 0);
  
    return parseFloat(result.toFixed(2));
}

export default {
  NONE(){
    return {result: undefined, code: 'NONE'}
  },

  SUMSUB(rec, fieldName='ref'){
    const {__children} = rec;

    if(__children !== undefined){
      const code = sumCode(__children, fieldName);
      const result = sumResult(__children, fieldName);
      return { code, result }
    } else {
      return {code: 'NORM', result: 0};
    }
  },
  SUB1(rec, fieldName='ref'){
    if (rec.__children && rec.__children.length > 0){
      const {result, code} = rec.__children[0][fieldName];
      return {result, code};
    } else {
      return {result: 0, code: 'WARN'};
    }
  }
};
