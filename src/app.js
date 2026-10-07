App = {
  web3Provider: null,
  account: '0x0',
  loading: false,
  contractInstance: null,
  contractAddress: null,

  init: async () => {
    await App.initWeb3();
    await App.initContracts();
    await App.render();
  },

  initWeb3: async () => {
    if (window.ethereum) {
      App.web3Provider = window.ethereum;
      window.web3 = new Web3(window.ethereum);
      try {
        await window.ethereum.request({ method: 'eth_requestAccounts' });
      } catch (error) {
        console.error("User denied account access", error);
      }
    } else if (window.web3) {
      App.web3Provider = window.web3.currentProvider;
      window.web3 = new Web3(window.web3.currentProvider);
    } else {
      App.web3Provider = new Web3.providers.HttpProvider('http://127.0.0.1:7545');
      window.web3 = new Web3(App.web3Provider);
    }

    if (window.ethereum) {
      window.ethereum.on('accountsChanged', () => App.render());
      window.ethereum.on('chainChanged', () => window.location.reload());
    }
  },

  initContracts: async () => {
    try {
      const contractData = await $.getJSON('MyContract.json');
      let networkId;
      try {
        networkId = await web3.eth.net.getId();
      } catch (err) {
        networkId = null;
      }
      console.log("Connected Network ID:", networkId);

      let deployedNetwork = networkId ? contractData.networks[networkId] : null;
      if (!deployedNetwork) {
        if (contractData.networks['5777']) {
          deployedNetwork = contractData.networks['5777'];
        } else if (contractData.networks['1337']) {
          deployedNetwork = contractData.networks['1337'];
        } else {
          const networkKeys = Object.keys(contractData.networks);
          if (networkKeys.length > 0) {
            deployedNetwork = contractData.networks[networkKeys[networkKeys.length - 1]];
          }
        }
      }

      if (deployedNetwork && deployedNetwork.address) {
        App.contractAddress = deployedNetwork.address;
        App.contractInstance = new web3.eth.Contract(contractData.abi, App.contractAddress);
        console.log("Contract Initialized at Address:", App.contractAddress);
      } else {
        console.error("No deployed contract address found in JSON.");
      }
    } catch (e) {
      console.error("Error loading contract JSON:", e);
    }
  },

  render: async () => {
    if (App.loading) return;
    App.setLoading(true);

    try {
      const accounts = await web3.eth.getAccounts();
      App.account = (accounts && accounts.length > 0) ? accounts[0] : 'Not Connected';
      $('#account').html(App.account);

      if (!App.contractInstance) {
        await App.initContracts();
      }

      if (App.contractInstance) {
        $('#contractAddress').html(App.contractAddress);
        let code = '0x';
        try {
          code = await web3.eth.getCode(App.contractAddress);
        } catch (e) {
          code = '0x';
        }

        if (!code || code === '0x' || code === '0x0') {
          // Try local Ganache node fallback (http://127.0.0.1:7545)
          try {
            const localWeb3 = new Web3(new Web3.providers.HttpProvider('http://127.0.0.1:7545'));
            const localCode = await localWeb3.eth.getCode(App.contractAddress);
            if (localCode && localCode !== '0x' && localCode !== '0x0') {
              const contractData = await $.getJSON('MyContract.json');
              const localContract = new localWeb3.eth.Contract(contractData.abi, App.contractAddress);
              const value = await localContract.methods.get().call();
              $('#value').html(value + " <br><small class='text-warning font-weight-normal' style='font-size:0.8rem;'>⚠️ MetaMask is on a different network. Switch MetaMask to <strong>Ganache / Localhost 7545 (Chain ID 1337)</strong> to submit updates.</small>");
              App.setLoading(false);
              return;
            }
          } catch (localErr) {
            console.error("Local RPC check failed:", localErr);
          }

          $('#value').html("<span class='text-danger'>Contract not deployed on connected MetaMask network. Please switch MetaMask network to Localhost 7545 (HTTP://127.0.0.1:7545, Network ID 5777).</span>");
          App.setLoading(false);
          return;
        }

        const value = await App.contractInstance.methods.get().call();
        $('#value').html(value);
      } else {
        $('#value').html("Contract not loaded");
      }
    } catch (err) {
      console.error("Error rendering app:", err);
      $('#value').html("Error reading contract: " + err.message);
    }

    App.setLoading(false);
  },

  set: async () => {
    if (!App.contractInstance) {
      alert("Smart contract is not loaded yet. Please refresh or check MetaMask connection.");
      return;
    }
    App.setLoading(true);
    const newValue = $('#newValue').val();
    try {
      let accounts = await web3.eth.getAccounts();
      if (!accounts || accounts.length === 0) {
        accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      }
      
      await App.contractInstance.methods.set(newValue).send({ from: accounts[0] });
      
      const updatedValue = await App.contractInstance.methods.get().call();
      $('#value').html(updatedValue);
      window.alert('Value updated successfully on the Blockchain!');
    } catch (err) {
      console.error("Set error:", err);
      alert('Transaction failed: ' + (err.message || err));
    }
    App.setLoading(false);
  },

  setLoading: (boolean) => {
    App.loading = boolean;
    const loader = $('#loader');
    const content = $('#content');
    if (boolean) {
      loader.show();
      content.hide();
    } else {
      loader.hide();
      content.show();
    }
  }
};

$(window).on('load', () => {
  App.init();
});