import React, { Component } from 'react';
import {
  AppRegistry,
  StyleSheet,
  Text,
  View,
  TouchableHighlight,
  NativeAppEventEmitter,
  NativeEventEmitter,
  NativeModules,
  Platform,
  PermissionsAndroid,
  ListView,
  ScrollView,
  AppState,
  Dimensions,
  TextInput,
  TouchableOpacity
} from 'react-native';

const window = Dimensions.get('window');
const ds = new ListView.DataSource({rowHasChanged: (r1, r2) => r1 !== r2});

import BleManager from 'react-native-ble-manager';
const BleManagerModule = NativeModules.BleManager;
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule);

import {
  Button,
} from './styles'

import ScanBarcode from './scanQr';

import { withAuthenticator } from 'aws-amplify-react-native'
import Amplify, { Auth, PubSub } from 'aws-amplify'
import { AWSIoTProvider } from '@aws-amplify/pubsub/lib/Providers'
import AWS from 'aws-sdk'
import awsconfig from './aws-exports';
Auth.configure(awsconfig);

Amplify.addPluggable(new AWSIoTProvider({
  aws_pubsub_region: 'us-east-1',
  aws_pubsub_endpoint: 'wss://a1wkfsvgpw3qeh-ats.iot.us-east-1.amazonaws.com/mqtt',
}));

class App extends Component {
  constructor(props){
    super(props)
    this.state = {
      scanning:false,
      peripherals: new Map(),
      text:'',
      appState: ''
    }
  }

  componentDidMount() {
    AppState.addEventListener('change', this.handleAppStateChange);
    BleManager.start({showAlert: false});
    this.handlerDiscover = bleManagerEmitter.addListener('BleManagerDiscoverPeripheral', this.handleDiscoverPeripheral );
    this.handlerStop = bleManagerEmitter.addListener('BleManagerStopScan', this.handleStopScan );
    this.handlerDisconnect = bleManagerEmitter.addListener('BleManagerDisconnectPeripheral', this.handleDisconnectedPeripheral );
    this.handlerUpdate = bleManagerEmitter.addListener('BleManagerDidUpdateValueForCharacteristic', this.handleUpdateValueForCharacteristic );

    if (Platform.OS === 'android' && Platform.Version >= 23) {
        PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION).then((result) => {
            if (result) {
              console.log("Permission is OK", result);
              this.setState({permission:true})
            } else {
              PermissionsAndroid.requestPermission(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION).then((result) => {
                if (result) {
                  console.log("User accept");
                } else {
                  console.log("User refuse");
                }
              });
            }
      });
    }
  }

  handleAppStateChange = (nextAppState) => {
    if (this.state.appState.match(/inactive|background/) && nextAppState === 'active') {
      console.log('App has come to the foreground!')
      BleManager.getConnectedPeripherals([]).then((peripheralsArray) => {
        console.log('Connected peripherals: ' + peripheralsArray.length);
      });
    }
    this.setState({appState: nextAppState});
  }

  componentWillUnmount() {
    this.handlerDiscover.remove();
    this.handlerStop.remove();
    this.handlerDisconnect.remove();
    this.handlerUpdate.remove();
  }

  handleDisconnectedPeripheral = (data) => {
    let peripherals = this.state.peripherals;
    let peripheral = peripherals.get(data.peripheral);
    if (peripheral) {
      peripheral.connected = false;
      peripherals.set(peripheral.id, peripheral);
      this.setState({peripherals});
    }
    console.log('Disconnected from ' + data.peripheral);
  }

  handleUpdateValueForCharacteristic = (data) => {
    console.log('data: ', data);
    console.log('Received data from ' + data.peripheral + ' characteristic ' + data.characteristic, data.value);
    alert(data.value)
  }

  handleStopScan = () => {
    console.log('Scan is stopped');
    this.setState({ scanning: false });
  }

  startScan = () => {
    if (!this.state.scanning) {
      this.setState({peripherals: new Map()});
      BleManager.scan([], 10, true).then((results) => {
        console.log('Scanning...');
        this.setState({scanning:true, peripheralInfo: false});
      });
    }
  }

  retrieveConnected(){
    BleManager.getConnectedPeripherals([]).then((results) => {
      if (results.length == 0) {
        console.log('No connected peripherals')
      }
      console.log(results);
      let peripherals = this.state.peripherals;
      for (let i = 0; i < results.length; i++) {
        let peripheral = results[i];
        peripheral.connected = true;
        peripherals.set(peripheral.id, peripheral);
        this.setState({ peripherals });
      }
    });
  }

  handleDiscoverPeripheral = (peripheral) => {
    let peripherals = this.state.peripherals;
    if (!peripherals.has(peripheral.id)){
      peripherals.set(peripheral.id, peripheral);
      this.setState({ peripherals })
    }
  }

  updateUser = async () => {
    if(!this.state.thingName) return false
    const user = await Auth.currentAuthenticatedUser()
    Auth.updateUserAttributes(user, {
      'custom:attached_device': (this.state.thingName)
      }).then(result => {
        console.log('updateUserAttributes', result);
      }).catch(err => {
        console.log('error is aws update user  ',err)
      })
  }

  test(peripheral) {
    if (peripheral){
      if (peripheral.connected){
        BleManager.disconnect(peripheral.id);
      }else{
        BleManager.connect(peripheral.id).then(() => {
          let peripherals = this.state.peripherals;
          let p = peripherals.get(peripheral.id);
          if (p) {
            p.connected = true;
            peripherals.set(peripheral.id, p);
            this.setState({peripherals});
          }
          BleManager.retrieveServices(peripheral.id).then((peripheralInfo) => {
            console.log('peripheralInfo: ', peripheralInfo);
            this.updateUser()
            let service = false
            let bakeCharacteristic = '2test';
            if(peripheralInfo.characteristics)
              for(let i=0;i<peripheralInfo.characteristics.length;i=i+1){
                let char = peripheralInfo.characteristics[i]
                let prop = char.properties
                if(prop.Notify){
                  bakeCharacteristic = char.characteristic
                  service = char.service
                }
            }
            if(!service) return alert('no notify access')
            this.setState({peripheralInfo})
            BleManager.startNotification(peripheralInfo.id, service, bakeCharacteristic).then(() => {
              console.log('Started notification on ' + peripheralInfo.id);
            }).catch((error) => {
              console.log('Notification error', error);
            });
          });
        }).catch((error) => {
          console.log('Connection error', error);
        });
      }
    }
  }

  sendMessage = (param) => {
    const {peripheralInfo, text} = this.state
    const self = this
    if(!peripheralInfo) return false
    let service = '1';
    let writeChar = '2';
    if(peripheralInfo.characteristics)
    for(let i=0;i<peripheralInfo.characteristics.length;i=i+1){
      let char = peripheralInfo.characteristics[i]
      let prop = char.properties
      if(prop.Write){
        writeChar = char.characteristic
        service = char.service
      }
    }
    if(!service) return alert('No Write Access')
    BleManager.write(peripheralInfo.id, service, writeChar, [parseInt(param)]).then(() => {
      console.log('param: ', param);
      alert('Successfully sent Message : '+param)
      self.setState({text:''})
    }).catch((error) => {
      console.log('Write error', error);
    })
  }

  async createThing(qrData) {
    this.setState({qrData})
    const thingName = qrData.rawData
    if(!thingName) return false
    const credentials = await Auth.currentCredentials();
    const iot = new AWS.Iot({
      region: 'us-east-1',
      credentials: Auth.essentialCredentials(credentials)
    });

    const params = {
      thingName, /* required */
      thingTypeName: 'match-master'
    };
    iot.createThing(params, (err, data) => {
      if (err) alert(JSON.stringify(err,null, 4))
      else this.setState({thingName})
    })
  }

  render() {
    const list = Array.from(this.state.peripherals.values());
    const { peripheralInfo, text, permission, scanning, qrData} = this.state
    const Btext = permission ? ('Bluetooth scanning : ' + (scanning ? 'ON' : 'OFF')) : 'Loading'
    const {user:{username}} = Auth
    return (
      <View style={styles.container}>
        {!qrData && <ScanBarcode fetchData={(qrData)=>this.createThing(qrData)}/>}
        {qrData && <View>
        <Button disabled={!permission} onPress={this.startScan} >
          <Text>{Btext}</Text>
        </Button>
        <Button onPress={()=>this.setState({qrData:false})} >
          <Text>Scan QR Again</Text>
        </Button>
        <Button onPress={()=>Auth.signOut().then(data => this.props.onStateChange('signIn',{}))}>
          <Text>{`Log Out ( ${username} )`}</Text>
        </Button>
        { peripheralInfo && <View>
          <Text style={{textAlign: 'center'}}>Connected Device : {peripheralInfo.name}</Text>
          <TextInput
            style={{height: 40,margin: 20}}
            placeholder="Enter Message"
            value = {text}
            onChangeText={(text) => this.setState({text})}
          />
          <Button onPressIn={()=>this.sendMessage(this.state.text)} onPressOut={()=>this.sendMessage(3)}>
            <Text>Send Message</Text>
          </Button>
        </View>}

        { !peripheralInfo && <ScrollView  style={styles.scroll}>
          {(list.length == 0) &&
            <View style={{flex:1, margin: 20}}>
              <Text style={{textAlign: 'center'}}>No peripherals</Text>
            </View>
          }

          {list.map((item, i) => {
            if(!item.name) return false
            return (
              <Button key={i} onPress={() => this.test(item) }>
                <View >
                  <Text style={{fontSize: 12, textAlign: 'center', color: '#333333', padding: 1}}>{item.name}</Text>
                  <Text style={{fontSize: 12, textAlign: 'center', color: '#333333', padding: 1}}>{item.id}</Text>
                </View>
              </Button>
            );
          })}
        </ScrollView>}
        </View>
        }
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
    width: window.width,
    height: window.height
  },
  scroll: {
    // backgroundColor: '#f0f0f0',
    margin: 10,
  }
});

export default withAuthenticator(App)