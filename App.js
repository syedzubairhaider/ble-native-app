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
} from 'react-native';
import BleManager from 'react-native-ble-manager';

const window = Dimensions.get('window');
const ds = new ListView.DataSource({rowHasChanged: (r1, r2) => r1 !== r2});

const BleManagerModule = NativeModules.BleManager;
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule);

export default class App extends Component {
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
              console.log("Permission is OK");
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

  startScan() {
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
      if(peripheral.name)console.log('Got ble peripheral', peripheral);
      peripherals.set(peripheral.id, peripheral);
      this.setState({ peripherals })
    }
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

  sendMessage(){
    const {peripheralInfo, text} = this.state
    const self = this
    if(!text || !peripheralInfo) return false
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
    BleManager.write(peripheralInfo.id, service, writeChar, [parseInt(text)]).then(() => {
      alert('Successfully sent Message : '+text)
      self.setState({text:''})
    }).catch((error) => {
      console.log('Write error', error);
    })
  }

  render() {
    const list = Array.from(this.state.peripherals.values());
    const dataSource = ds.cloneWithRows(list);
    const { peripheralInfo, text} = this.state

    return (
      <View style={styles.container}>
        <TouchableHighlight style={{marginTop: 40,margin: 20, padding:20, backgroundColor:'#ccc'}} onPress={() => this.startScan() }>
          <Text>Scan Bluetooth ({this.state.scanning ? 'on' : 'off'})</Text>
        </TouchableHighlight>
        { peripheralInfo && <View>
          <Text style={{textAlign: 'center'}}>Connected Device : {peripheralInfo.name}</Text>
          <TextInput
            style={{height: 40,margin: 20}}
            placeholder="Enter Message"
            value = {text}
            onChangeText={(text) => this.setState({text})}
          />
          <TouchableHighlight style={{marginTop: 0,margin: 20, padding:20, backgroundColor:'#ccc'}} onPress={() => this.sendMessage() }>
            <Text>Send Message</Text>
          </TouchableHighlight>
        </View>}
        {!peripheralInfo && <ScrollView style={styles.scroll}>
          {(list.length == 0) &&
            <View style={{flex:1, margin: 20}}>
              <Text style={{textAlign: 'center'}}>No peripherals</Text>
            </View>
          }
          <ListView
            enableEmptySections={true}
            dataSource={dataSource}
            renderRow={(item) => {
              const color = item.connected ? 'green' : '#fff';
              if(!item.name) return false
              return (
                <TouchableHighlight onPress={() => this.test(item) }>
                  <View style={[styles.row, {backgroundColor: color}]}>
                    <Text style={{fontSize: 12, textAlign: 'center', color: '#333333', padding: 10}}>{item.name}</Text>
                    <Text style={{fontSize: 12, textAlign: 'center', color: '#333333', padding: 10}}>{item.id +'  '+ item.rssi}</Text>
                  </View>
                </TouchableHighlight>
              );
            }}
          />
        </ScrollView>}
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
    flex: 1,
    backgroundColor: '#f0f0f0',
    margin: 10,
  },
  row: {
    margin: 10
  },
});