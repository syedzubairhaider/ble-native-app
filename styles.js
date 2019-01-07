import styled from 'styled-components'

export const Button = styled.TouchableOpacity`
  marginTop: 40;
  marginHorizontal: 20;
  marginVertical: 20;
  paddingVertical: 20;
  paddingHorizontal: 20;
  backgroundColor:#ccc;
`;

export const Btn = styled.TouchableOpacity`
  padding-vertical: 10px;
  ${props => !!props.block && css`width: ${props.block}`};
`
