import React, { Component } from 'react';
import QRCodeScanner from 'react-native-qrcode-scanner';
 
import {
  StyleSheet,
  Text,
  View,
  Platform,
} from 'react-native';


import {
  Button,
} from './styles'


export default class ScanScreen extends Component {
  render() {
    return (
			<View style={{flex: 1}}>
				<QRCodeScanner
					cameraProps={{captureAudio: false}}
					onRead={ (e)=> this.props.fetchData(e)}
				/>
        <Button onPress={()=>this.props.fetchData({rawData:false})} >
          <Text>Skip Scaning</Text>
        </Button>
			</View>
    )
  }
}