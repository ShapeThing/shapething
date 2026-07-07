import type { CompletionResult } from "@codemirror/autocomplete";
import { LanguageSupport, LRLanguage } from "@codemirror/language";
import { styleTags, tags } from "@lezer/highlight";
import { LRParser } from "@lezer/lr";
import { basicSetup, EditorView } from "codemirror";
import { useEffect, useRef } from "react";

const parser = LRParser.deserialize({
  version: 14,
  states:
    "-zQYQPOOO!QQPO'#CaO!YQPO'#CdO!_QPO'#CeO!gQPO'#CfOOQO'#C_'#C_O!lQQO'#CiO!qQPO'#CiOOQO'#D]'#D]OOQO'#D^'#D^O!vQPO'#CwO#UQPO'#CzO$nQPO'#CmOOQO'#Ch'#ChO!vQPO'#CgO$uQSO'#CgOOQO'#DV'#DVO%WQQO'#DVO%]QSO'#C}QYQPOOO&ZQPO,58{O&`QPO,58{O&eQQO,59OO&jQPO,59PO&oQPO,59POOQO,59Q,59QOOQO,59T,59TO&tQQO,59TOOQO'#Cx'#CxO#gQPO'#DkO&yQPO,59cOOQO'#C{'#C{O!vQPO,59fOOQO'#Db'#DbO'OQWO'#CoOOQO'#Cu'#CuOOQO'#Cv'#CvOOQO'#Da'#DaOOQO'#Cn'#CnOOQO'#DO'#DOO(`QPO,59XOOQO,59X,59XOOQO,59R,59ROOQO,59q,59qOOQO'#DR'#DRO(gQSO,59iOOQO-E6{-E6{O)eQQO1G.gO)jQPO1G.gOOQO1G.j1G.jOOQO1G.k1G.kO)oQPO1G.kOOQO1G.o1G.oO)tQQO'#CoO*iQPO'#DmO+QQPO,5:VOOQO1G.}1G.}O,ZQPO1G/QOOQO,59Z,59ZO,bQPO,59ZOOQO-E6|-E6|OOQO1G.s1G.sO,mQQO'#DmO-OQQO,5:VOOQO-E7P-E7POOQO7+$R7+$RO-WQQO7+$ROOQO7+$V7+$VO!vQPO'#CyO!vQPO'#CyO#gQPO'#DPO-]QPO,5:XO-]QPO,5:XO.PQPO'#DQO.^QPO1G/qOOQO'#C|'#C|O.lQPO7+$lOOQO1G.u1G.uO.qQQO,5:XO.qQQO,5:XO.|QSO'#DQO/TQQO1G/qOOQO<<Gm<<GmO/]QPO,59eO/bQPO,59eO/gQPO,59kOOQO-E6}-E6}O0OQPO1G/sO#gQPO,59lOOQO-E7O-E7OOOQO<<HW<<HWO0aQQO,59kO0rQQO1G/sOOQO1G/P1G/POOQO1G/V1G/VOOQO1G/W1G/WO#gQPO'#DkO#gQPO'#DPO#gQPO,59l",
  stateData:
    "1Y~OxOSPOS~OUVOVWO_XO`XOzPO{UO|QO}RO!OSO!S[O!^YO!iZO~OUeO{dO~OVfO~OUhO{gO~OViO~O^jO~O{kO~OUVOVWO{UO!`lO~OUVOVWO_oO{UO!iZO~OUVOVWO_XO`XOdqOeqOfqOgqO{UO!S[O!WsO!XsO!YsO!ZtO![tO!^YO!iZO~O!RyO~P#gOUVOVWO{UO!`lOSZX~OS{O~OS|OUqXVqX_qX`qXvqXzqX{qX|qX}qX!OqX!SqX!^qX!iqX~OV!PO~O{!QO~OS!RO~OV!SO~O{!TO~O^!UO~O!]!YO~Oh![O!V!]OUcXVcX_cX`cXdcXecXfcXgcX{cX!RcX!ScX!WcX!XcX!YcX!ZcX![cX!^cX!icX~O!R!_O~P#gOS|OUqaVqa_qa`qavqazqa{qa|qa}qa!Oqa!Sqa!^qa!iqa~OS!cO~OV!dO~OV!eO~Oh![O!V!]O!]cX!bcX!dcX!fcX!gcXScX!hcX!ccX!ecX~O!b!fO!d!gO!f!hO!]!aX!g!aX!c!aX!e!aX~O!g!kO!]!_a!c!_a!e!_a~OUVOVWOdqOeqOfqOgqO{UO!WsO!XsO!YsO!ZtO![tO!iZO~O_!mO~P+`OUVOVWO{UO~O!b!fO!d!gO!f#TOS!aX!g!aX~O!g!rOS!_a~OS!tO~O!f!hO!]!aa!g!aa!c!aa!e!aa~OUVOVWO{UO!`lO!gtX~O!]tX!ctX!etX~P-nO!g!kO!]!_i!c!_i!e!_i~O!h!|O~O!f#TOS!aa!g!aa~OStX~P-nO!g!rOS!_i~O!c#PO~O!e#PO~O!b!fO!d!gO!]sa!fsa!gsa!csa!esa~O!f!hO!]!ai!g!ai!c!ai!e!ai~O!b!fO!d!gOSsa!fsa!gsa~O!f#TOS!ai!g!ai~O!`!O}!Z![U!W!X!Y![~",
  goto: "([!bPPP!cP!gPP!g!g!g!k!o!sPPP#[#j#|PPPPP#|#|$X$g$y%T%i%l%o%u%{&_&iPPP&oPPPPP&s#[PP%['fPPPPPPPP'sP(QT`OcTTOcTaOcT^Oc{WOYZ[^_cmpx!Z!]!f!g!h!k!r!z#S#T#US]Ocav[mx!h!z#S#T#USw[xS!Wm!zS!`#S#UQ!w!hR!}#Tcu[mx!Z!h!z#S#T#US_Ocav[mx!h!z#S#T#UUmY!f!gQ!ZpQ!z!kS#S^_R#U!rQ!j!WQ!q!`T#Q!w!}S]OcQoZ`v[mx!h!z#S#T#UR!m!ZRpZR!n!ZQcOR!OcQx[R!^xQ!i!WQ!p!`W!x!i!p!y#OQ!y!jR#O!qQ!l!XQ!s!aT!{!l!sQ}bR!b}TbOcS]Oc`lY^_p!f!g!k!rQoZ`v[mx!h!z#S#T#UQ!m!ZR!o!]Sr[x_!Vm!Z!h!z#S#T#UQnYSz^_Q!u!fR!v!gQ!XmQ!a#ST#R!z#U",
  nodeNames:
    "⚠ LineComment TurtleDoc Directive . PrefixID PN_PREFIX IRIREF Base SparqlPrefix SparqlBase Triples Subject PrefixedName PN_LOCAL BlankNode Anon Collection Object RDFLiteral String_literal_quote String_literal_single_quote String_literal_long_quote String_literal_long_single_quote Langtag NumericLiteral BooleanLiteral BlankNodePropertyList Verb Annotation QuotedTriple QtSubject QtObject",
  maxTerm: 71,
  skippedNodes: [0, 1],
  repeatNodeCount: 5,
  tokenData:
    "!?v~RxXY#oYZ#o]^#opq#ors#tst,Owx,Zxy4eyz4j{|4o|}6g}!O4o!O!P6l!Q![6t![!]8u!]!^8z!^!_9P!`!a:l!b!c:w!c!d@h!d!eBx!e!r@h!r!sHP!s!}@h!}#O! y#P#Q!!v#Q#R!!{#R#S!#W#T#U!'s#U#V!)O#V#Y@h#Y#Z!,z#Z#d@h#d#e!3b#e#h@h#h#i!:P#i#o@h#o#p!?Z#p#q!?f#q#r!?q~#tOx~~#wVOY$^Z]$^^r$^rs'rs#O$^#O#P${#P~$^~$aVOY$^Z]$^^r$^rs$vs#O$^#O#P${#P~$^~${Od~~%OYrs$^wx$^!w!x%n#O#P$^#U#V$^#Y#Z$^#b#c$^#f#g$^#h#i$^#i#j&p~%qR!Q![%z!c!i%z#T#Z%z~%}R!Q![&W!c!i&W#T#Z&W~&ZR!Q![&d!c!i&d#T#Z&d~&gR!Q![&p!c!i&p#T#Z&p~&sR!Q![&|!c!i&|#T#Z&|~'PR!Q!['Y!c!i'Y#T#Z'Y~']R!Q!['f!c!i'f#T#Z'f~'iR!Q![$^!c!i$^#T#Z$^~'wPd~rs'z~'}TOr'zrs(^s#O'z#O#P)X#P~'z~(aTOr'zrs(ps#O'z#O#P)X#P~'z~(sTOr'zrs)Ss#O'z#O#P)X#P~'z~)XOf~~)[Yrs'zwx'z!w!x)z#O#P'z#U#V'z#Y#Z'z#b#c'z#f#g'z#h#i'z#i#j*|~)}R!Q![*W!c!i*W#T#Z*W~*ZR!Q![*d!c!i*d#T#Z*d~*gR!Q![*p!c!i*p#T#Z*p~*sR!Q![*|!c!i*|#T#Z*|~+PR!Q![+Y!c!i+Y#T#Z+Y~+]R!Q![+f!c!i+f#T#Z+f~+iR!Q![+r!c!i+r#T#Z+r~+uR!Q!['z!c!i'z#T#Z'z~,TQP~OY,OZ~,O~,^VOY,sZ],s^w,swx0Xx#O,s#O#P-b#P~,s~,vVOY,sZ],s^w,swx-]x#O,s#O#P-b#P~,s~-bOe~~-eYrs,swx,s!w!x.T#O#P,s#U#V,s#Y#Z,s#b#c,s#f#g,s#h#i,s#i#j/V~.WR!Q![.a!c!i.a#T#Z.a~.dR!Q![.m!c!i.m#T#Z.m~.pR!Q![.y!c!i.y#T#Z.y~.|R!Q![/V!c!i/V#T#Z/V~/YR!Q![/c!c!i/c#T#Z/c~/fR!Q![/o!c!i/o#T#Z/o~/rR!Q![/{!c!i/{#T#Z/{~0OR!Q![,s!c!i,s#T#Z,s~0^Pe~wx0a~0dTOw0awx0sx#O0a#O#P1n#P~0a~0vTOw0awx1Vx#O0a#O#P1n#P~0a~1YTOw0awx1ix#O0a#O#P1n#P~0a~1nOg~~1qYrs0awx0a!w!x2a#O#P0a#U#V0a#Y#Z0a#b#c0a#f#g0a#h#i0a#i#j3c~2dR!Q![2m!c!i2m#T#Z2m~2pR!Q![2y!c!i2y#T#Z2y~2|R!Q![3V!c!i3V#T#Z3V~3YR!Q![3c!c!i3c#T#Z3c~3fR!Q![3o!c!i3o#T#Z3o~3rR!Q![3{!c!i3{#T#Z3{~4OR!Q![4X!c!i4X#T#Z4X~4[R!Q![0a!c!i0a#T#Z0a~4jO!S~~4oO!R~X4rQ!O!P4x!Q![5xX4{P!Q![5OX5TR!XX!Q![5O!g!h5^#X#Y5^X5aR{|5j}!O5j!Q![5pX5mP!Q![5pX5uP!YX!Q![5pX5}S!WX!O!P6Z!Q![5x!g!h5^#X#Y5^X6^R!Q![5O!g!h5^#X#Y5^~6lO!f~_6qPSU!Q![5OZ6{X^Q!WX!O!P6Z!Q![6t!c!g7h!g!h7y!h!}7h#R#S7h#T#X7h#X#Y7y#Y#o7hQ7mS^Q!Q![7h!c!}7h#R#S7h#T#o7hZ8OU^Q{|5j}!O5j!Q![8b!c!}7h#R#S7h#T#o7hZ8iS^Q!YX!Q![8b!c!}7h#R#S7h#T#o7h~8zO{~~9PO!g~~9SYqr9rs!^9r!^!_:g!_!`9r!`!a:b!a#O9r#P#Q9r#R#S9r#T#o9r#r~9r~9uXqr9rs!^9r!_!`9r!`!a:b!a#O9r#P#Q9r#R#S9r#T#o9r#r~9r~:gOV~~:lO!i~~:oP!`!a:r~:wO!h~~:zV!c!};a#T#U;a#U#V<^#V#d;a#d#e=y#e#o;a#o#p@cY;fRhY}!O;o!c!};a#T#o;aY;rR!Q![;{!c!};{#T#o;{Y<QShY}!O;o!Q![;{!c!};{#T#o;{_<cShY}!O;o!c!};a#T#U<o#U#o;a_<tThY}!O;o!c!};a#T#g;a#g#h=T#h#o;a_=YThY}!O;o!c!};a#T#X;a#X#Y=i#Y#o;a_=pR|ThY}!O;o!c!};a#T#o;a_>OThY}!O;o!c!};a#T#f;a#f#g>_#g#o;a_>dThY}!O;o!c!};a#T#X;a#X#Y>s#Y#o;a_>xThY}!O;o!c!};a#T#Y;a#Y#Z?X#Z#o;a_?^ThY}!O;o!c!};a#T#];a#]#^?m#^#o;a_?rThY}!O;o!c!};a#T#l;a#l#m@R#m#o;a_@YRzThY}!O;o!c!};a#T#o;a~@hO!d~_@o`^QU]!Q![7h!c!}@h#R#S7h#T#o@h%W%oAq%p&aAq&b1pAq4U4dAq4e$ISAq$I`$IbAq$Kh%#tAq&/x&EtAq&FV;'SAq;'S;:jBr?&r?AhAq?BY?MnAq]Av^U]!c!}Aq#T#oAq%W%oAq%p&aAq&b1pAq4U4dAq4e$ISAq$I`$IbAq$Kh%#tAq&/x&EtAq&FV;'SAq;'S;:jBr?&r?AhAq?BY?MnAq]BuP;=`<%lAq_CPa^QU]!Q![7h!c!dDU!d!}@h#R#S7h#T#o@h%W%oAq%p&aAq&b1pAq4U4dAq4e$ISAq$I`$IbAq$Kh%#tAq&/x&EtAq&FV;'SAq;'S;:jBr?&r?AhAq?BY?MnAq_D]b^QU]!Q![7h!c!u@h!u!vEe!v!}@h#R#S7h#T#o@h%W%oAq%p&aAq&b1pAq4U4dAq4e$ISAq$I`$IbAq$Kh%#tAq&/x&EtAq&FV;'SAq;'S;:jBr?&r?AhAq?BY?MnAq_Elb^QU]!Q![7h!c!g@h!g!hFt!h!}@h#R#S7h#T#o@h%W%oAq%p&aAq&b1pAq4U4dAq4e$ISAq$I`$IbAq$Kh%#tAq&/x&EtAq&FV;'SAq;'S;:jBr?&r?AhAq?BY?MnAq_F}`^Q!OTU]!Q![7h!c!}@h#R#S7h#T#o@h%W%oAq%p&aAq&b1pAq4U4dAq4e$ISAq$I`$IbAq$Kh%#tAq&/x&EtAq&FV;'SAq;'S;:jBr?&r?AhAq?BY?MnAq_HWb^QU]!Q![7h!c!t@h!t!uI`!u!}@h#R#S7h#T#o@h%W%oAq%p&aAq&b1pAq4U4dAq4e$ISAq$I`$IbAq$Kh%#tAq&/x&EtAq&FV;'SAq;'S;:jBr?&r?AhAq?BY?MnAq_Igb^QU]!Q![7h!c!g@h!g!hJo!h!}@h#R#S7h#T#o@h%W%oAq%p&aAq&b1pAq4U4dAq4e$ISAq$I`$IbAq$Kh%#tAq&/x&EtAq&FV;'SAq;'S;:jBr?&r?AhAq?BY?MnAq_Jvb^QU]!Q![7h!c!h@h!h!iLO!i!}@h#R#S7h#T#o@h%W%oAq%p&aAq&b1pAq4U4dAq4e$ISAq$I`$IbAq$Kh%#tAq&/x&EtAq&FV;'SAq;'S;:jBr?&r?AhAq?BY?MnAq_LVb^QU]!Q![7h!c!k@h!k!lM_!l!}@h#R#S7h#T#o@h%W%oAq%p&aAq&b1pAq4U4dAq4e$ISAq$I`$IbAq$Kh%#tAq&/x&EtAq&FV;'SAq;'S;:jBr?&r?AhAq?BY?MnAq_Mfb^QU]!Q![7h!c!z@h!z!{Nn!{!}@h#R#S7h#T#o@h%W%oAq%p&aAq&b1pAq4U4dAq4e$ISAq$I`$IbAq$Kh%#tAq&/x&EtAq&FV;'SAq;'S;:jBr?&r?AhAq?BY?MnAq_Nw`^Q}TU]!Q![7h!c!}@h#R#S7h#T#o@h%W%oAq%p&aAq&b1pAq4U4dAq4e$ISAq$I`$IbAq$Kh%#tAq&/x&EtAq&FV;'SAq;'S;:jBr?&r?AhAq?BY?MnAq~!!OT!^~XY!!_YZ!!_]^!!_pq!!_#P#Q!!q~!!bTXY!!_YZ!!_]^!!_pq!!_#P#Q!!q~!!vO`~~!!{O!]~~!#OP#Q#R!#R~!#WO!V~_!#]T^Q!Q![7h![!]!#l!c!}7h#R#S7h#T#o7h]!#o`!Q![!$q!c!}!$q#R#S!$q#T#o!$q%W%o!$q%p&a!$q&b1p!$q4U4d!$q4e$IS!$q$I`$Ib!$q$Kh%#t!$q&/x&Et!$q&FV;'S!$q;'S;:j!'m?&r?Ah!$q?BY?Mn!$q]!$ve_]}!O!$q!O!P!&X!Q![!$q!c!}!$q#R#S!$q#T#o!$q$}%O!$q%W%o!$q%p&a!$q&b1p!$q1p4U!$q4U4d!$q4e$IS!$q$I`$Ib!$q$Je$Jg!$q$Kh%#t!$q&/x&Et!$q&FV;'S!$q;'S;:j!'m?&r?Ah!$q?BY?Mn!$q]!&[e}!O!$q!O!P!&X!Q![!$q!c!}!$q#R#S!$q#T#o!$q$}%O!$q%W%o!$q%p&a!$q&b1p!$q1p4U!$q4U4d!$q4e$IS!$q$I`$Ib!$q$Je$Jg!$q$Kh%#t!$q&/x&Et!$q&FV;'S!$q;'S;:j!'m?&r?Ah!$q?BY?Mn!$q]!'pP;=`<%l!$q_!'|`^Q!`TU]!Q![7h!c!}@h#R#S7h#T#o@h%W%oAq%p&aAq&b1pAq4U4dAq4e$ISAq$I`$IbAq$Kh%#tAq&/x&EtAq&FV;'SAq;'S;:jBr?&r?AhAq?BY?MnAq_!)Va^QU]!Q![7h!c!}@h#R#S7h#T#U!*[#U#o@h%W%oAq%p&aAq&b1pAq4U4dAq4e$ISAq$I`$IbAq$Kh%#tAq&/x&EtAq&FV;'SAq;'S;:jBr?&r?AhAq?BY?MnAq_!*cb^QU]!Q![7h!c!}@h#R#S7h#T#g@h#g#h!+k#h#o@h%W%oAq%p&aAq&b1pAq4U4dAq4e$ISAq$I`$IbAq$Kh%#tAq&/x&EtAq&FV;'SAq;'S;:jBr?&r?AhAq?BY?MnAq_!+rb^QU]!Q![7h!c!}@h#R#S7h#T#X@h#X#YFt#Y#o@h%W%oAq%p&aAq&b1pAq4U4dAq4e$ISAq$I`$IbAq$Kh%#tAq&/x&EtAq&FV;'SAq;'S;:jBr?&r?AhAq?BY?MnAq_!-Ra^QU]!Q![7h!c!}@h#R#S7h#T#U!.W#U#o@h%W%oAq%p&aAq&b1pAq4U4dAq4e$ISAq$I`$IbAq$Kh%#tAq&/x&EtAq&FV;'SAq;'S;:jBr?&r?AhAq?BY?MnAq_!._b^QU]!Q![7h!c!}@h#R#S7h#T#`@h#`#a!/g#a#o@h%W%oAq%p&aAq&b1pAq4U4dAq4e$ISAq$I`$IbAq$Kh%#tAq&/x&EtAq&FV;'SAq;'S;:jBr?&r?AhAq?BY?MnAq_!/nb^QU]!Q![7h!c!}@h#R#S7h#T#g@h#g#h!0v#h#o@h%W%oAq%p&aAq&b1pAq4U4dAq4e$ISAq$I`$IbAq$Kh%#tAq&/x&EtAq&FV;'SAq;'S;:jBr?&r?AhAq?BY?MnAq_!0}b^QU]!Q![7h!c!}@h#R#S7h#T#X@h#X#Y!2V#Y#o@h%W%oAq%p&aAq&b1pAq4U4dAq4e$ISAq$I`$IbAq$Kh%#tAq&/x&EtAq&FV;'SAq;'S;:jBr?&r?AhAq?BY?MnAq_!2``^Q![XU]!Q![7h!c!}@h#R#S7h#T#o@h%W%oAq%p&aAq&b1pAq4U4dAq4e$ISAq$I`$IbAq$Kh%#tAq&/x&EtAq&FV;'SAq;'S;:jBr?&r?AhAq?BY?MnAq_!3ib^QU]!Q![7h!c!}@h#R#S7h#T#f@h#f#g!4q#g#o@h%W%oAq%p&aAq&b1pAq4U4dAq4e$ISAq$I`$IbAq$Kh%#tAq&/x&EtAq&FV;'SAq;'S;:jBr?&r?AhAq?BY?MnAq_!4xb^QU]!Q![7h!c!}@h#R#S7h#T#X@h#X#Y!6Q#Y#o@h%W%oAq%p&aAq&b1pAq4U4dAq4e$ISAq$I`$IbAq$Kh%#tAq&/x&EtAq&FV;'SAq;'S;:jBr?&r?AhAq?BY?MnAq_!6Xb^QU]!Q![7h!c!}@h#R#S7h#T#Y@h#Y#Z!7a#Z#o@h%W%oAq%p&aAq&b1pAq4U4dAq4e$ISAq$I`$IbAq$Kh%#tAq&/x&EtAq&FV;'SAq;'S;:jBr?&r?AhAq?BY?MnAq_!7hb^QU]!Q![7h!c!}@h#R#S7h#T#]@h#]#^!8p#^#o@h%W%oAq%p&aAq&b1pAq4U4dAq4e$ISAq$I`$IbAq$Kh%#tAq&/x&EtAq&FV;'SAq;'S;:jBr?&r?AhAq?BY?MnAq_!8wb^QU]!Q![7h!c!}@h#R#S7h#T#l@h#l#mNn#m#o@h%W%oAq%p&aAq&b1pAq4U4dAq4e$ISAq$I`$IbAq$Kh%#tAq&/x&EtAq&FV;'SAq;'S;:jBr?&r?AhAq?BY?MnAq_!:Wb^QU]!Q![7h!c!}@h#R#S7h#T#f@h#f#g!;`#g#o@h%W%oAq%p&aAq&b1pAq4U4dAq4e$ISAq$I`$IbAq$Kh%#tAq&/x&EtAq&FV;'SAq;'S;:jBr?&r?AhAq?BY?MnAq_!;gb^QU]!Q![7h!c!}@h#R#S7h#T#i@h#i#j!<o#j#o@h%W%oAq%p&aAq&b1pAq4U4dAq4e$ISAq$I`$IbAq$Kh%#tAq&/x&EtAq&FV;'SAq;'S;:jBr?&r?AhAq?BY?MnAq_!<vb^QU]!Q![7h!c!}@h#R#S7h#T#X@h#X#Y!>O#Y#o@h%W%oAq%p&aAq&b1pAq4U4dAq4e$ISAq$I`$IbAq$Kh%#tAq&/x&EtAq&FV;'SAq;'S;:jBr?&r?AhAq?BY?MnAq_!>X`^Q!ZXU]!Q![7h!c!}@h#R#S7h#T#o@h%W%oAq%p&aAq&b1pAq4U4dAq4e$ISAq$I`$IbAq$Kh%#tAq&/x&EtAq&FV;'SAq;'S;:jBr?&r?AhAq?BY?MnAq~!?^P#p#q!?a~!?fO!b~~!?iP#q#r!?l~!?qO!c~~!?vO!e~",
  tokenizers: [0, 1, 2, 3],
  topRules: { TurtleDoc: [0, 2] },
  tokenPrec: 735,
});

// eslint-disable-next-line @typescript-eslint/no-unused-expressions
({
  "@prefix": tags.meta,
  "@base": tags.meta,
  a: tags.meta,
  "<...>": tags.atom,
  "'' ... '' or \"...#": tags.literal,
  ":": tags.operator,
  "until:": tags.variableName, // variable-3
});

const TurtleLanguage = LRLanguage.define({
  parser: parser.configure({
    props: [
      styleTags({
        IRIREF: tags.atom,
        LineComment: tags.lineComment,
        "_:": tags.operator,
        ":": tags.operator,
        PN_PREFIX: tags.namespace,
        a: tags.meta,
        "@prefix": tags.meta,
        BASE: tags.meta,
        PREFIX: tags.meta,
        base: tags.meta,
        prefix: tags.meta,
        "@base": tags.meta,
        BlankNodeLabel: tags.variableName,
        NumericLiteral: tags.unit,
        BooleanLiteral: tags.unit,
      }),
    ],
  }),
  languageData: {
    commentTokens: { line: "#" },
  },
});
function autocomplete(): CompletionResult | null {
  // console.log(context);
  return null;
}

export const turtleCompletion = TurtleLanguage.data.of({
  autocomplete,
});
function turtle() {
  return new LanguageSupport(TurtleLanguage, [turtleCompletion]);
}

export function Turtle({
  onChange,
  value,
}: {
  onChange: (value: string) => void;
  value: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const editor = useRef<EditorView>(null);

  useEffect(() => {
    if (!ref.current || ref.current.childNodes.length) return;
    editor.current = new EditorView({
      parent: ref.current,
      doc: value,
      extensions: [
        basicSetup,
        turtle(),

        EditorView.focusChangeEffect.of((state: { doc: { toString: () => string } }, focusing: boolean) => {
          if (!focusing) {
            const newContent = state.doc.toString();
            onChange(newContent);
          }
          return null;
        }),
      ],
    });
  }, [ref.current]);

  useEffect(() => {
    const state = editor.current?.state;
    if (!state) return;
    const transaction = state.update({
      changes: { from: 0, to: state.doc.length, insert: value },
    });
    editor.current!.update([transaction]);
  }, [value, editor.current]);

  return <div className="turtle-editor" ref={ref}></div>;
}
