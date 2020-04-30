/* eslint-disable jsx-a11y/heading-has-content */
import React from 'react';
import styled from '@emotion/styled';

import CodeBlock from './codeBlock';
import AnchorTag from './anchor';

const StyledPre = styled('pre')`
  padding: 16px;
  background: ${props => props.theme.colors.preFormattedText};
`;

export default {
  h1(props) {
    return (
      <h1 className="heading1" id={props.children.replace(/\s+/g, '').toLowerCase()} {...props} />
    );
  },
  h2(props) {
    return (
      <h2 className="heading2" id={props.children.replace(/\s+/g, '').toLowerCase()} {...props} />
    );
  },
  h3(props) {
    return (
      <h3 className="heading3" id={props.children.replace(/\s+/g, '').toLowerCase()} {...props} />
    );
  },
  h4(props) {
    return (
      <h4 className="heading4" id={props.children.replace(/\s+/g, '').toLowerCase()} {...props} />
    );
  },
  h5(props) {
    return (
      <h5 className="heading5" id={props.children.replace(/\s+/g, '').toLowerCase()} {...props} />
    );
  },
  h6(props) {
    return (
      <h6 className="heading6" id={props.children.replace(/\s+/g, '').toLowerCase()} {...props} />
    );
  },
  p(props) {
    return <p className="paragraph" {...props} />;
  },
  pre(props) {
    return (
      <StyledPre>
        <pre {...props} />
      </StyledPre>
    );
  },
  code: CodeBlock,
  a: AnchorTag,
};
