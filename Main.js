import React from 'react';
import { Linking, Button, StyleSheet, Text, View, TextInput } from 'react-native';
import { withAuthenticator } from 'aws-amplify-react-native'
import Amplify, { Auth, Analytics } from 'aws-amplify'
// import Auth from '@aws-amplify/auth';
// import Analytics from '@aws-amplify/analytics';

import awsconfig from './aws-exports';

// retrieve temporary AWS credentials and sign requests
Auth.configure(awsconfig);
// send analytics events to Amazon Pinpoint
Analytics.configure(awsconfig);

class Main extends React.Component {
    constructor(props) {
      super(props);
      this.state = {
        username:'t1',
        email:'zubair.haider+1@kwanso.com',
        password:'Kwanso1!',
        eventsSent: 0
      };
    }




signUp = () => {
  username = 'test1'
  password = 'Kwanso1!'
  email = 'zubair.haider@kwanso.com'
  Auth.signUp({
    username,
    password,
    attributes: {
        email,          // optional
        // phone_number,   // optional - E.164 number convention
        // other custom attributes 
    },
    validationData: []  //optional
    })
    .then(data => console.log(data))
    .catch(err => {
    self.setState({err})

      console.log('e1: ',err)
    });

// After retrieveing the confirmation code from the user
// Auth.confirmSignUp(username, code, {
//     // Optional. Force user confirmation irrespective of existing alias. By default set to True.
//     forceAliasCreation: true    
// }).then(data => console.log(data))
//   .catch(err => {
//     this.setState({err})
//     console.log(err)
//   });

Auth.resendSignUp(username).then(() => {
    console.log('code resent successfully');
}).catch(e => {
    console.log('e2',e);
    this.setState({error:e})
});
}

    input (type,value) {
      return (

        <TextInput
        style={{height: 40,margin: 20}}
        placeholder={type}
        value = {value || ''}
        onChangeText={(val) => this.setState({[type]:val})}
      />
      )
    }

    render() {
      const {username, email, password, error} = this.state
      console.log('error: ', error);
      return (
        <View style={styles.container}>
          <Text>you are logged in !!</Text>

          {this.input('username',username)}
          {this.input('email',email)}
          {this.input('password',password)}

          <Button title="Sign Up" onPress={this.signUp} />

            {error && <Text>{error.message}</Text>}

          {this.state.resultHtml}
        </View>
      );
    }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  link: {
    color: 'blue'
  }
});

export default withAuthenticator(Main)