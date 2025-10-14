export function loadJoditUmd(jsUrl: string, cssUrl?: string, globalName = 'Jodit'): Promise<any> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject('window not available');

    // CSS
    if (cssUrl && !document.querySelector(`link[data-jodit-css="${cssUrl}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = cssUrl;
      link.setAttribute('data-jodit-css', cssUrl);
      document.head.appendChild(link);
    }

    // If global already present, resolve immediately
    if ((window as any)[globalName]) {
      return resolve((window as any)[globalName]);
    }

    // Script already in DOM?
    const existingScript = document.querySelector(`script[src="${jsUrl}"]`);
    if (existingScript) {
      const checkIfReady = () => {
        if ((window as any)[globalName]) return resolve((window as any)[globalName]);
        setTimeout(checkIfReady, 50);
      };
      checkIfReady();
      return;
    }

    const script = document.createElement('script');
    script.src = jsUrl;
    script.async = true;
    script.onload = () => {
      if ((window as any)[globalName]) resolve((window as any)[globalName]);
      else reject(new Error(`${globalName} not found on window after script load`));
    };
    script.onerror = (e) => reject(new Error('Failed to load Jodit UMD script: ' + e));
    document.body.appendChild(script);
  });
}
