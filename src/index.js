import React, {useState, createContext} from 'react';
import Agnt from 'superagent';
import {add, del, set, trav, parse} from '@marvintau/chua';
import func from './funcs';

export const Exchange = createContext({
  Sheets: {},
  status: '',
  addSheets: () => {},
  refreshSheet: () => {},
  evalSheet: () => {},

  getSuggs: () => {},
  addSiblyRec: () => {},
  addChildRec: () => {},
  remRec: () => {},
  setField: () => {},

  pull: () => {},
  push: () => {},
  fetchURL: () => {}
})

export const ExchangeProvider = ({defaultColumnAliases, children}) => {

  const [Sheets, setSheets] = useState({__COL_ALIASES:{...defaultColumnAliases}, __VARS:{}, __PATH_ALIASES: {}});
  const [status, setStatus] = useState('INIT');
  
  const addSheets = (newSheets) => {
    console.log('add sheet called');
    setSheets({...Sheets, ...newSheets});
    setStatus('DONE_ADDED');
  }

  // When refreshing sheets, a new instance of sheet collection
  // is created, and a shallow copy of the specified sheet is 
  // made too.
  const refreshSheet = (sheetName) => {
    setSheets({...Sheets, [sheetName]: {...Sheets[sheetName]}});
  }

  const setField = (sheetName, path, fieldName, value) => {
    const {data, indexColumn} = Sheets[sheetName];
    const kvs = {[fieldName]: value};
    set(data, kvs, {path, indexColumn});
  }

  const addSiblyRec = (sheetName, path, newRec) => {
    
    const newPath = path.slice();
    const atIndex = newPath.pop();
    
    const {data, indexColumn} = Sheets[sheetName];
    add(data, newRec, {path:newPath, indexColumn, atIndex});
  }

  const addChildRec = (sheetName, path, newRec) => {
    const {data, indexColumn} = Sheets[sheetName];
    add(data, newRec, {path, indexColumn});
  }

  const remRec = (sheetName, path) => {
    const newPath = path.slice();
    const atIndex = newPath.pop();

    const {data, indexColumn} = Sheets[sheetName];
    console.log(newPath, indexColumn, 'del');
    del(data, {path: newPath, indexColumn, atIndex});
  }

  const initPathAliases = () => {
    if (Sheets.__PATH_ALIASES === undefined || Object.keys(Sheets.__PATH_ALIASES).length === 0){
      const categoryAliases = {};
      if (Sheets.CATEGORY_NAME_ALIASES) {
        const {data: aliasData} = Sheets.CATEGORY_NAME_ALIASES;
        
        for (let {alias} of aliasData){
          for (let name of alias){
            categoryAliases[name] = alias;
          }
        }
        
        Sheets.__PATH_ALIASES = categoryAliases;
      }
    }
  }

  const evalSheet = (sheetName) => {

    initPathAliases();
    const evalRecord = (rec) => {
      for (let key of Object.keys(rec)){
        const {expr} = rec[key];
        if (expr !== undefined){
          const {result, code} = parse(expr.toString(), {func, tables: Sheets, self: rec});
          Object.assign(rec[key], {result, code});
        }
      }  
    }

    trav(Sheets[sheetName].data, evalRecord, 'POST');
    refreshSheet(sheetName);
  }

  const getSuggs = (expr) => {
    const {suggs=[]} = parse(expr, {func, tables: Sheets});
    return suggs;
  }

  const fetchURL = async (url) => {
    const params = new URLSearchParams(url);
    const {sheet, ...rest} = Object.fromEntries(params.entries());

    if (sheet === undefined){
      setStatus('DEAD_FETCH_NO_SHEET_NAME');
      return;
    }

    try {
      console.log(rest, 'rest');
      const {body:{data}} = await Agnt.post(`/fetch/${sheet}`).send(rest);
      return data;
    } catch (error){
      console.log(error);
    }
  }

  const pull = (sheetNameList, currPage) => {
    console.log(sheetNameList, 'pull');
    (async() => {
      setStatus('PULL');
      let pulledSheets = {};
      for (let sheetName of sheetNameList){
  
        try{
          const {body:{data, indexColumn, error}} = await Agnt.post(`/pull/${sheetName}`).send(currPage);
          console.log(data, 'pull')
          if (error) {
            setStatus(error);
            return;
          }

          pulledSheets[sheetName] = {data, indexColumn};

        } catch(e){
          console.error(e);
          setStatus('DEAD_LOAD');
          return
        }
      }
      addSheets(pulledSheets);
      setStatus('DONE_PULL');
    })()
  }

  const push = (sheetName, {type, crit, rec, key, val, ...rem}) => {
    (async () => {
      setStatus('PUSH');
      try{
        const payload = ['ADD_REC', 'REM_REC'].includes(type)
        ? {type, rec}
        : type === 'UPDATE'
        ? {type, rec, key, val}
        : {type, data: Sheets[sheetName].data, ...rem}

        const response = await Agnt.post(`/push/${sheetName}`).send(payload);
        if (response.error){
          throw Error(response.error.message);
        }
        setStatus('DONE');
  
      } catch(e){
        console.error(e);
        setStatus('DEAD_LOAD');
      }
      setStatus('DONE_PUSH');
    })()
  }

  return <Exchange.Provider value={{
      Sheets, status, addSheets, refreshSheet, evalSheet,
      setField, addSiblyRec, addChildRec, remRec, getSuggs,
      pull, push, fetchURL,
    }}>
    {children}
  </Exchange.Provider>
}