import styled, {css} from 'styled-components'

export const Button = styled.TouchableOpacity`
  marginTop: 20;
  marginHorizontal: 20;
  paddingVertical: 10;
  paddingHorizontal: 20;
  backgroundColor:#ccc;
  ${props => !!props.marginTop && css`marginTop: ${props.marginTop}`};
`