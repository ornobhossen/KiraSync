(function(){
  try{
    var saved = localStorage.getItem('kirasycn-theme');
    document.documentElement.setAttribute('data-theme', saved === 'light' ? 'light' : 'dark');
  }catch(e){ document.documentElement.setAttribute('data-theme','dark'); }
})();
