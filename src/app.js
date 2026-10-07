// ── RentChain DApp — app.js (v2, design-reference matched) ──────────────────
const App = {
  web3: null,
  account: null,
  contract: null,
  contractAddress: null,
  summary: null,
  _toastTimer: null,

  // ── Init ───────────────────────────────────────────────────────────────────
  init: async () => {
    try {
      await App.initWeb3();
      await App.initContract();
      await App.render();
    } catch (err) {
      console.error(err);
      App.showToast('Connection failed: ' + err.message, 'danger');
      document.getElementById('loader').style.display = 'none';
      document.getElementById('appShell').style.display = '';
    }
  },

  initWeb3: async () => {
    if (window.ethereum) {
      App.web3 = new Web3(window.ethereum);
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      window.ethereum.on('accountsChanged', () => App.render());
      window.ethereum.on('chainChanged', () => window.location.reload());
    } else {
      App.web3 = new Web3(new Web3.providers.HttpProvider('http://127.0.0.1:7545'));
    }
    const accounts = await App.web3.eth.getAccounts();
    App.account = accounts[0] || null;
  },

  initContract: async () => {
    const res = await fetch('RentalAgreement.json');
    if (!res.ok) throw new Error('Cannot load RentalAgreement.json');
    const data = await res.json();

    const netId = await App.web3.eth.net.getId();
    let net = data.networks[netId];
    if (!net) {
      const keys = Object.keys(data.networks);
      if (keys.length) net = data.networks[keys[keys.length - 1]];
    }
    if (!net || !net.address) throw new Error('Contract not deployed on this network. Run: npx truffle migrate --reset');

    App.contractAddress = net.address;
    App.contract = new App.web3.eth.Contract(data.abi, net.address);
  },

  // ── Render ─────────────────────────────────────────────────────────────────
  render: async () => {
    try {
      const accounts = await App.web3.eth.getAccounts();
      App.account = accounts[0] || null;

      // Topbar: wallet + network
      const short = App.account ? App.account.slice(0,6) + '…' + App.account.slice(-4) : '—';
      document.getElementById('walletShort').textContent = short;

      const netId = await App.web3.eth.net.getId();
      if (netId == 5777 || netId == 1337) {
        document.getElementById('networkLabel').textContent = 'Ganache';
        document.getElementById('networkStrong').textContent = 'Local';
      } else {
        document.getElementById('networkLabel').textContent = 'Network';
        document.getElementById('networkStrong').textContent = '#' + netId;
      }

      // Load summary
      const s = await App.contract.methods.getSummary().call();
      App.summary = {
        landlord:       s._landlord,
        tenant:         s._tenant,
        property:       s._property,
        rent:           s._rent,
        deposit:        s._deposit,
        duration:       parseInt(s._duration),
        leaseStart:     parseInt(s._leaseStart),
        depositBalance: s._depositBalance,
        status:         s._status,
        paymentCount:   parseInt(s._paymentCount)
      };

      App.renderMetastrip();
      App.renderDetails();
      await App.renderHistory();
      App.renderActions();

      document.getElementById('loader').style.display = 'none';
      document.getElementById('appShell').style.display = '';
    } catch (err) {
      console.error('Render error:', err);
      App.showToast('Error: ' + err.message, 'danger');
    }
  },

  refresh: async () => {
    const btn = document.getElementById('refreshBtn');
    btn.textContent = '↻ Refreshing…';
    btn.disabled = true;
    await App.render();
    btn.textContent = '↻ Refresh status';
    btn.disabled = false;
  },

  // ── Metastrip ──────────────────────────────────────────────────────────────
  renderMetastrip: () => {
    const s = App.summary;
    // Status dot
    const dotClass = App.statusDotClass(s.status);
    const dot = document.getElementById('statusDot');
    dot.className = 'status-dot ' + dotClass;
    document.getElementById('statusText').textContent = s.status;

    // Contract address
    document.getElementById('metaContract').textContent =
      App.contractAddress.slice(0,6) + '…' + App.contractAddress.slice(-4);

    // Role
    const role = App.computeRole();
    document.getElementById('metaRole').innerHTML = '<span class="role-icon">' + App.roleIcon(role) + '</span>' + role;

    // Payments
    document.getElementById('metaPayments').innerHTML =
      s.paymentCount + ' <span class="payments-of">of ' + s.duration + '</span>';

    // Card accent border
    const dc = document.getElementById('detailsCard');
    dc.className = 'card accent-left ' + dotClass;
  },

  // ── Details ────────────────────────────────────────────────────────────────
  renderDetails: () => {
    const s = App.summary;
    const eth = (w) => parseFloat(App.web3.utils.fromWei(w, 'ether')).toFixed(4) + ' ETH';

    document.getElementById('fProperty').textContent = s.property;
    document.getElementById('fRent').textContent     = eth(s.rent);
    document.getElementById('fDeposit').textContent  = eth(s.deposit);
    document.getElementById('fDuration').textContent = s.duration + ' months';

    // Landlord addr with copy button
    const landlordShort = s.landlord.slice(0,6) + '…' + s.landlord.slice(-5);
    document.getElementById('fLandlord').innerHTML =
      landlordShort + ' <button type="button" data-copy="' + s.landlord + '" aria-label="Copy landlord address">⧉</button>';

    // Tenant addr
    const isNoTenant = !s.tenant || s.tenant === '0x0000000000000000000000000000000000000000';
    if (isNoTenant) {
      document.getElementById('fTenant').innerHTML = '<span style="color:var(--text-faint);font-size:13px;">Not yet assigned</span>';
      document.getElementById('fTenant').className = 'field-value';
    } else {
      const tenantShort = s.tenant.slice(0,6) + '…' + s.tenant.slice(-5);
      document.getElementById('fTenant').innerHTML =
        tenantShort + ' <button type="button" data-copy="' + s.tenant + '" aria-label="Copy tenant address">⧉</button>';
      document.getElementById('fTenant').className = 'field-value addr mono';
    }

    // Lease start
    document.getElementById('fLeaseStart').textContent =
      s.leaseStart > 0 ? new Date(s.leaseStart * 1000).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—';

    // Escrow balance
    const escrowEl = document.getElementById('fEscrow');
    const depBal   = parseFloat(App.web3.utils.fromWei(s.depositBalance, 'ether'));
    if (depBal === 0 && (s.status === 'Closed' || s.status === 'Settled')) {
      escrowEl.textContent = '0.0000 ETH · returned';
      escrowEl.className   = 'field-value zero mono';
    } else {
      escrowEl.textContent = eth(s.depositBalance);
      escrowEl.className   = 'field-value mono';
    }

    // Amount pills
    document.getElementById('depositPill').textContent = eth(s.deposit);
    document.getElementById('rentPill').textContent    = eth(s.rent);

    // Dispute banner
    const banner = document.getElementById('disputeBanner');
    if (s.status === 'Disputed') {
      App.contract.methods.disputedDeduction().call().then(d => {
        document.getElementById('disputeDeductionBanner').textContent = eth(d);
      });
      App.contract.methods.disputeReason().call().then(r => {
        document.getElementById('disputeReasonBanner').textContent = r;
      });
      banner.style.display = '';
    } else {
      banner.style.display = 'none';
    }

    // Wire copy buttons
    App.wireCopyButtons();
  },

  // ── History ────────────────────────────────────────────────────────────────
  renderHistory: async () => {
    const count = App.summary.paymentCount;
    const list  = document.getElementById('historyList');
    if (count === 0) {
      list.innerHTML = '<div class="empty">No rent payments recorded yet.</div>';
      return;
    }
    const rows = [];
    for (let i = 0; i < count; i++) {
      const p    = await App.contract.methods.getRentPayment(i).call();
      const eth  = parseFloat(App.web3.utils.fromWei(p.amount, 'ether')).toFixed(4);
      const date = new Date(parseInt(p.timestamp) * 1000)
        .toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
      rows.push(
        '<div class="history-row">' +
        '<span class="history-idx mono">#' + (i+1) + '</span>' +
        '<span class="history-amt mono">' + eth + ' ETH</span>' +
        '<span class="history-spacer"></span>' +
        '<span class="history-date mono">' + date + '</span>' +
        '</div>'
      );
    }
    list.innerHTML = '<div class="history-list">' + rows.join('') + '</div>';
  },

  // ── Actions ────────────────────────────────────────────────────────────────
  renderActions: () => {
    const s          = App.summary;
    const acc        = (App.account || '').toLowerCase();
    const isLandlord = acc === s.landlord.toLowerCase();
    const isTenant   = s.tenant && s.tenant !== '0x0000000000000000000000000000000000000000'
                       && acc === s.tenant.toLowerCase();

    const all = ['actAccept','actDeposit','actActive','actEndLandlord',
                 'actEndTenant','actDisputed','actClosed','actObserver'];
    all.forEach(id => document.getElementById(id).style.display = 'none');

    const show = id => document.getElementById(id).style.display = '';

    if (s.status === 'Closed' || s.status === 'Settled') { show('actClosed'); return; }

    if (s.status === 'Created') {
      if (!isLandlord) show('actAccept'); else show('actObserver'); return;
    }
    if (s.status === 'Accepted') {
      if (isTenant) show('actDeposit'); else show('actObserver'); return;
    }
    if (s.status === 'Active') {
      if (isTenant)    show('actActive');
      else             show('actObserver');
      return;
    }
    if (s.status === 'End Requested') {
      if (isLandlord)  show('actEndLandlord');
      else if (isTenant) show('actEndTenant');
      else             show('actObserver');
      return;
    }
    if (s.status === 'Disputed') {
      if (isTenant)    show('actDisputed');
      else             show('actObserver');
      return;
    }
    show('actObserver');
  },

  // ── Contract calls ─────────────────────────────────────────────────────────
  acceptAgreement: async () => {
    await App._send(() => App.contract.methods.acceptAgreement(), 0, 'Agreement accepted! You are now the tenant.');
  },
  payDeposit: async () => {
    await App._send(() => App.contract.methods.payDeposit(), App.summary.deposit, 'Deposit paid and held in escrow!');
  },
  payRent: async () => {
    await App._send(() => App.contract.methods.payRent(), App.summary.rent, 'Rent paid to landlord!');
  },
  requestLeaseEnd: async () => {
    await App._send(() => App.contract.methods.requestLeaseEnd(), 0, 'Lease end requested!');
  },
  approveDepositReturn: async () => {
    await App._send(() => App.contract.methods.approveDepositReturn(), 0, 'Deposit returned to tenant!');
  },
  raiseDispute: async () => {
    const eth    = document.getElementById('deductionAmt').value;
    const reason = document.getElementById('deductionReason').value.trim();
    if (!eth || !reason) { App.showToast('Fill in deduction amount and reason.', 'danger'); return; }
    const wei = App.web3.utils.toWei(eth, 'ether');
    await App._send(() => App.contract.methods.raiseDispute(wei, reason), 0, 'Dispute raised!');
  },
  acceptDeduction: async () => {
    await App._send(() => App.contract.methods.acceptDeduction(), 0, 'Deduction accepted — deposit settled!');
  },
  claimDepositAfterTimeout: async () => {
    await App._send(() => App.contract.methods.claimDepositAfterTimeout(), 0, 'Deposit claimed after timeout!');
  },

  _send: async (methodFn, valueWei, successMsg) => {
    if (!App.account) { App.showToast('No account connected.', 'danger'); return; }
    try {
      App.showToast('Sending transaction…');
      const opts = { from: App.account };
      if (parseInt(valueWei) > 0) opts.value = valueWei;
      await methodFn().send(opts);
      App.showToast(successMsg, 'ok');
      await App.refresh();
    } catch (err) {
      console.error(err);
      const msg = (err.data && err.data.message) || err.message || 'Transaction failed';
      App.showToast(msg, 'danger');
    }
  },

  // ── Helpers ────────────────────────────────────────────────────────────────
  computeRole: () => {
    if (!App.account || !App.summary) return 'Observer';
    const acc = App.account.toLowerCase();
    if (acc === App.summary.landlord.toLowerCase()) return 'Landlord';
    const t = App.summary.tenant;
    if (t && t !== '0x0000000000000000000000000000000000000000' && acc === t.toLowerCase()) return 'Tenant';
    return 'Observer';
  },
  roleIcon: (role) => role === 'Landlord' ? '👔 ' : role === 'Tenant' ? '🏠 ' : '👀 ',
  statusDotClass: (status) => {
    if (status === 'Active')                      return 'active';
    if (status === 'Disputed')                    return 'disputed';
    if (status === 'End Requested' || status === 'Accepted') return 'pending';
    if (status === 'Created')                     return 'created';
    return 'closed';
  },
  wireCopyButtons: () => {
    document.querySelectorAll('[data-copy]').forEach(btn => {
      btn.onclick = () => {
        const val  = btn.getAttribute('data-copy');
        const prev = btn.textContent;
        navigator.clipboard && navigator.clipboard.writeText(val)
          .then(() => { btn.textContent = '✓'; setTimeout(() => btn.textContent = prev, 1200); })
          .catch(() => {});
      };
    });
  },
  showToast: (msg, type = '') => {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className   = 'toast' + (type ? ' ' + type : '');
    clearTimeout(App._toastTimer);
    App._toastTimer = setTimeout(() => t.className = 'toast hidden', 4000);
  }
};

window.addEventListener('load', () => App.init());