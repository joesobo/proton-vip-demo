import { ConnectWallet } from '@protonprotocol/proton-web-sdk';
import { PROTON_CHAIN } from '../constants/proton-chain.constant';
import ProtonVIPLogo from '../../util/proton-logo-color.png';
import firebaseService from './firebase.service';

class ProtonSDK {
  public chainId;
  public endpoints;
  public appName;
  public requestAccount;
  public session;
  public link;
  public user;

  constructor() {
    this.chainId = PROTON_CHAIN.chainId;
    this.endpoints = PROTON_CHAIN.endpoints;
    this.appName = PROTON_CHAIN.appName;
    this.requestAccount = PROTON_CHAIN.requestAccount;
    this.session = null;
    this.link = null;
    this.user = null;
  }

  login = async () => {
    try {
      this.link = await ConnectWallet({
        linkOptions: { chainId: this.chainId, endpoints: this.endpoints },
        transportOptions: { requestAccount: this.requestAccount },
        selectorOptions: { appName: this.appName,appLogo: ProtonVIPLogo}
      });
      const { session } = await this.link.login(this.requestAccount);
      this.session = session;
      this.user = this._returnUserFromSession(session);
      return this.user;
    } catch (e) {
      console.warn('Auth error', e);
      return null;
    }
  }

  sendTransaction = async (amount, level) => {
    const actions = [{
      account: 'xtokens',
      name: 'transfer',
      authorization: [{
        actor: this.user.actor,
        permission: this.user.permission,
      }],
      data: {
        from: this.user.actor,
        to: this.requestAccount,
        quantity: `${amount}.000000 FOOBAR`,
        memo: 'ProtonVIP'
      }
    }];

    try {
      const result = await this.session.transact(
        { actions: actions },
        { broadcast: true }
      );
      await firebaseService.collection('members').add({
        user: this.user.actor,
        level
      });

      return result;
    } catch (e) {
      return e;
    }
  }

  logout = async () => {
    await this.link.removeSession(this.appName, this.session.auth);
    localStorage.removeItem('AUTH_USER_PROTON_VIP');
  }

  restoreSession = async () => {
    const savedUserAuth = JSON.parse(localStorage.getItem('AUTH_USER_PROTON_VIP'));
    if (savedUserAuth) {
      try {
        this.link = await ConnectWallet({
          linkOptions: { chainId: this.chainId, endpoints: this.endpoints},
          transportOptions: { requestAccount: this.requestAccount },
          selectorOptions: { appName: this.appName, appLogo: ProtonVIPLogo, showSelector: false}
        });
        const result = await this.link.restoreSession(this.appName, {
          actor: savedUserAuth.actor,
          permission: savedUserAuth.permission,
        });
        if (result) {
          this.session = result;
          this.user = this._returnUserFromSession(this.session);
          return this.user;
        }
      } catch (e) {
        console.warn('Session Restoration Error:', e);
        return null;
      }
    }
    return null;
  }

  _returnUserFromSession = (session) => {
    const auth = session.auth;
    const profile = session.accountData[0];
    const user = {
      actor: auth.actor,
      permission: auth.permission,
      avatar: profile.avatar,
      createdAt: profile.date,
      name: profile.name
    };
    return user;
  }

}

const ProtonService = new ProtonSDK();
export default ProtonService;
