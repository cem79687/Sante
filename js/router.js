// router.js — navigation entre écrans sans rechargement
// Usage : Router.go('home') / Router.go('add-medication')

const Router = (() => {

  const routes = {};
  let currentRoute = null;

  function register(name, renderFn) {
    routes[name] = renderFn;
  }

  function go(name, params = {}) {
    if (!routes[name]) {
      console.error(`Route inconnue : ${name}`);
      return;
    }
    currentRoute = name;
    window.scrollTo(0, 0);
    routes[name](params);
  }

  function current() { return currentRoute; }

  return { register, go, current };
})();

window.Router = Router;
