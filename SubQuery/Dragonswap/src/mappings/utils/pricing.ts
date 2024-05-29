// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { ADDRESS_ZERO, MINIMUM_KLAY_LOCKED, ONE_BD, ZERO_BD, ZERO_BI } from "./constants";
import { Bundle, Pool, Token, V2Pool, WhiteListPools } from "../../types";
import { BigNumber } from "@ethersproject/bignumber";
import { convertTokenToDecimal, safeDivNum } from "./index";
import assert from "assert";
// const request = require("request");
import axios from "axios";

const WKLAY_ADDRESS = "0x19Aac5f612f524B754CA7e7c41cbFa2E981A4432";
const USDC_WKLAY_03_POOL = "0x2C081F2EE4aC7C695CAf6ae0fCB83Ca4EdD0F61f";



// token where amounts should contribute to tracked volume and liquidity
// usually tokens that many tokens are paired with s
export const WHITELIST_TOKENS: string[] = [
  WKLAY_ADDRESS, // WKLAY
  "0x0000000000000000000000000000000000000000", // KLAY
  "0x999999999939ba65abb254339eec0b2a0dac80e9", // GCKLAY
  "0xEf82b1C6A550e730D8283E1eDD4977cd01FAF435", // SIX
  "0x5425B810432Bc7E7DBC74859eD3c37bB39d9dF00", // PXL
  "0x4dd402A7d54eaa8147Cb6fF252AFe5BE742bDF40", // HINT
  "0xBe7377DB700664331Beb28023cFbd46dE079efAc", // ATT
  "0x9657fb399847D85A9C1A234ECe9ca09D5c00f466", // ISR
  "0x3B3b30A76d169F72A0A38AE01b0D6e0FbeE3cc2e", // TEMCO
  "0x656f86dd0F3Bc25Af2D15855f2A2f142f9EaeD87", // BOX
  "0xAfdE910130C335fA5bD5fe991053E3E0a49dcE7b", // PIB
  "0x69EB6E14cE941d4d9d1c969dCF31bb105B7ae3D0", // XYZ
  "0xC4407f7DC4B37275c9ce0F839652b393e13fF3D1", // CLBK
  "0x27dCd181459bcdDC63c37baB1E404A313C0dfD79", // MNR
  "0x67B79DF99416aD638267Ec8D89eB61EaE330A005", // BNS
  "0xb1a7AbE0c5a9E06CC7585a435E74976D2DeE07f3", // BPT
  "0xa9CB7345Db22034F607c12Dd8E10ee703F6bAd61", // BOLTT
  "0x275F942985503d8CE9558f8377cC526A3aBa3566", // WIKEN
  "0x5c74070FDeA071359b86082bd9f9b3dEaafbe32b", // KDAI
  "0xceE8FAF64bB97a73bb51E115Aa89C17FfA8dD167", // oUSDT
  "0x34d21b1e550D73cee41151c77F3c73359527a396", // oETH
  "0xFe41102f325dEaa9F303fDd9484Eb5911a7BA557", // oORC
  "0x16D0e1fBD024c600Ca0380A4C5D57Ee7a2eCBf9c", // oWBTC
  "0xC6a2Ad8cC6e4A7E08FC37cC5954be07d499E7654", // KSP
  "0xA323d7386b671E8799dcA3582D6658FdcDcD940A", // SKLAY
  "0x9eaeFb09fe4aABFbE6b1ca316a3c36aFC83A393F", // oXRP
  "0x0c1D7CE4982FD63b1BC77044Be1da05C995E4463", // oTRIX
  "0x735106530578FB0227422De25bB32C9AdfB5Ea2e", // oXVS
  "0x36E5Ea82a099E8188BD5af5709B23628076DE822", // oCAKE
  "0x574e9c26bDA8b95D7329505b4657103710EB32eA", // oBNB
  "0x8583063110b5d29036eceD4db1CC147e78a86a77", // oAUTO
  "0xDFe180E288158231ffA5faF183ECA3301344a51F", // oBELT
  "0x5096dB80B21Ef45230C9E423C373f1FC9C0198dd", // WEMIX
  "0xD51C337147c8033a43F3B5ce0023382320C113Aa", // FINIX
  "0x8eF60f0a5A2db984431934f8659058E87CD5C70a", // KICX
  "0xdc229B451798774b2F2DE279Cbf13370BB802Fb5", // CFXT
  "0x75b5f0106F4094D6E3Dd38Bdc7acf7742596eA42", // MSC
  "0x754288077D0fF82AF7a5317C7CB8c444D421d103", // oUSDC
  "0x02cbE46fB8A1F579254a9B485788f2D86Cad51aa", // BORA
  "0xDd483a970a7A7FeF2B223C3510fAc852799a88BF", // MIX
  "0xdCd62c57182E780E23d2313C4782709Da85b9D6C", // SSX
  "0xE06b40df899b9717b4E6B50711E1dc72d08184cF", // HIBS
  "0xD19FFd0a9820dE2537F61E66194809897b8f906A", // BLUEPT
  "0x648fd38efeFb4F97cf2DF3ff93efF70e94Da0691", // MON
  "0x43e850C91817aC594eb38a632216132695d9740B", // PLR
  "0x2842a6D0C182E3F1cF4556311C48A7706D7BA6AD", // oGALA
  "0x5388Ce775De8F7A69d17Fd5CAA9f7dbFeE65Dfce", // oDON
  "0x7F223b1607171B81eBd68D22f1Ca79157Fd4A44b", // CT
  "0x07aA7aE19B17579F7237Ad72C616fECF4CCC787b", // ATT
  "0xB1834e4E773a180168f2292E036Ca8e17F86196F", // FDM
  "0xE815A060b9279ebA642F8C889FaB7afc0d0acA63", // META
  "0xBc5d3fb02514f975060d35000e99c54253002bd4", // oPACE
  "0xD068c52d81f4409B9502dA926aCE3301cc41f623", // MBX
  "0x7eeE60a000986E9efE7F5C90340738558c24317B", // PER
  "0x1223BaF4F5fb9c9002a2154262440B9eD09d01A7", // LAY
  "0x01aD62E0Ff6dcaA72889fcA155C7036c78Ca1783", // ORB
  "0x9E481eB17D3c3C07D7A6aB571B4Ba8eF432b5cF2", // MCC
  "0xE06597D02A2C3AA7a9708DE2Cfa587B128bd3815", // NPT
  "0xD676e57Ca65b827fEb112AD81Ff738E7B6c1048d", // KRNO
  "0x6555F93f608980526B5cA79b3bE2d4EdadB5C562", // sKRNO
  "0xE944134903694EBdbB56aaDcfBdF400fB52ea487", // wsKRNO
  "0xE79efff8A61567d932Be2A8C33057f7b2A8Bc43B", // Favor
  "0x37e35406c8d87ae243932bf4c9a2138c2b93c8fa", // FAVR
  "0x2B5065D6049099295C68f5fcb97B8b0d3c354df7", // ICT
  "0x4Fa62F1f404188CE860c8f0041d6Ac3765a72E67", // KSD
  "0xb15183D0d4D5E86ba702cE9bb7b633376e7db29f", // KOKOA
  "0xCd670d77f3dCAB82d43DFf9BD2C4b87339FB3560", // KOKOS
  "0x74BA03198FEd2b15a51AF242b9c63Faf3C8f4D34", // AKLAY
  "0x158BeFF8C8cDEbD64654ADD5F6A1d9937e73536c", // HOUSE
  "0x7b7363cf78662b638a87f63871c302Be363DdC7a", // WOOD
  "0x8888888888885B073f3C81258C27E83DB228d5f3", // SCNR
  "0xdAbeE145A1395E09280C23EA9Aa71CaCa35a1EC0", // NIK
  "0x01987adc61782639EA3b8497e030B13A4510CfBE", // STAT
  "0x46f307B58bf05Ff089BA23799FAE0e518557f87C", // ABL
  "0xEc47F42260438666cC88CE6Ef770283f2D19d39B", // JOY
  "0xfbD0314D55EAb31C9FC0b2D162748017F1bc7b85", // KROME
  "0xd2137Fdf10bD9e4E850C17539eB24cfe28777753", // USDK
  "0xE445E4A382cb58c26FD8811115e69E52357fe8FF", // XTC
  "0x7A1CdCA99FE5995ab8E317eDE8495c07Cbf488aD", // PALA
  "0xaB28E65341AF980A67dAB5400a03aAf41feF5b7e", // FTN
  "0xDaff9de20F4Ba826565b8C664fef69522E818377", // SGAS
  "0xE48ABc45d7cB8B7551334cF65EF50b8128032B72", // LAYV
  "0x5fFF3a6C16C2208103F318F4713D4D90601A7313", // KLEVA
  "0x976232eB7Eb92287fF06c5D145bD0d1C033eCA58", // WALK
  "0x84F8C3C8d6eE30a559D73Ec570d574f671E82647", // GRND
  "0x7626A70F82Ad37aA30cbD2d8b2F117c7A427E08a", // ARTRA
  "0xA80e96cCeB1419f9BD9F1c67F7978F51b534A11b", // GXA
  "0x02E973155b1f5f60A1Ff1c4E8E7f371C89526cbC", // IPV
  "0x949fC808138081aB1FcbcbB5F311440CF2C3Ff73", // KNS
  "0x08dA4D66604154E1c43689B8B25aEeD7d0343617", // sKNS
  "0x17d2628D30F8e9E966c9Ba831c9B9b01ea8Ea75C", // ISK
  "0x01839Ee16e16c0C0b771B78CCE6265C75c290110", // URT
  "0xE41F4664dAa237Ae01747ECc7c3151280C2FC8bf", // FGI
  "0xbe612a268b82B9365feEE67aFD34D26AacA0D6DE", // 0X
  "0x30C103f8f5A3A732DFe2dCE1Cc9446f545527b43", // JEWEL
  "0xB3F5867E277798b50ba7A71C0b24FDcA03045eDF", // JADE
  "0x8E6dB43ad726bB9049078b5dCc9f86aE2E6a2246", // OXT
  "0x99E5Ec3775bbb0BC92C08CA423c54B0478B2f6d8", // STAR
  "0x5166FA1AcbA89E5e0DE27841a1110B7f9aC112Da", // NOX
  "0x3043988aa54bb3ae4da60ecb1dc643c630a564f0", // AWM
  "0x02e7d9ad54a19a9a0721d9515cf9f80f9547d771", // KDG
  "0x03b79592596157d6bff16d8db87ad0b65319c5af", // ENTER
  "0x07ffbdba745f3a98ec462385aedcdcd973021671", // KSTAR
  "0x0ab503536019cb4303bda69467c1ec5de1589918", // 3KM
  "0x100bc15ae8b489c771d9740ea0bb1aea945a1f67", // oTON
  "0x119883ee408aa5b9625c5d09a79fa8be9f9f6017", // MKC
  "0x127a75b751ba810e459121af6207d83841c586b7", // oMESH
  "0x143d71be70dc518a9e9c25b6008d9353b3698d26", // OYAT
  "0x19c0d5ddcf06f282e7a547d25ab09fe5a7984aae", // PsuB
  "0x1cd3828a2b62648dbe98d6f5748a6b1df08ac7bb", // REDi
  "0x1e3a300601aa95ab7ea39bb72c3272716ef1426b", // ksTESLA
  "0x210bc03f49052169d5588a52c317f71cf2078b85", // oBUSD
  "0x22e3ac1e6595b64266e0b062e01fae31d9cdd578", // 4NUTS
  "0x27b33131a0b02879d63830292931281b1b83000f", // ASAN
  "0x29435457053d167a2b1f6f2d54d4176866ffb5f9", // COM
  "0x2b5d75db09af26e53d051155f5eae811db7aef67", // KP
  "0x2bf4d89453deb5781fccc656a4cac60710af766d", // oPOLA
  "0x2ef5f2642674f768b4efe9a7de470a6a68bcb8f3", // BYPE
  "0x2fade69ba4dcb112c530c48fdf41fc071685cede", // oRUSH
  "0x307ac5598abdf419456ce623c0977499777e5b67", // oMGOLD
  "0x321bc0b63efb1e4af08ec6d20c85d5e94ddaaa18", // BBC
  "0x3247abb921c83f81b406e1a87fb7bfa6f79262d0", // SALT
  "0x338d7933c367e49905c06f3a819cd60d541c9067", // SST
  "0x341ba3a6738fd107484fbc4f6b8f6c5fce75d339", // oMRST
  "0x35805bec6c7e3cf900ff8d1bb8267e535b1ddd76", // ZBZ
  "0x36709d1ed5298467eda41a68f97b4e58faeecd1a", // Aurory
  "0x37c38b19a6ba325486da87f946e72dc93e0ab39a", // PUNK
  "0x37cdc46c78cf403f1da8a1eebcffb3ed1dd01868", // SAK
  "0x37d46c6813b121d6a27ed263aef782081ae95434", // sKAI
  "0x3d7b9801ff79f9ea599663e7b43077c9486bd1f1", // PD
  "0x3f34671fba493ab39fbf4ecac2943ee62b654a88", // oHANDY
  "0x44efe1ec288470276e29ac3adb632bff990e2e1f", // vKAI
  "0x45dbbbcdff605af5fe27fd5e93b9f3f1bb25d429", // MUDOL
  "0x46db825593ca7c3fdfc9ccb5850ea96c39b79330", // NGIT
  "0x4836cc1f355bb2a61c210eaa0cd3f729160cd95e", // GHUB
  "0x4b734a4d5bf19d89456ab975dfb75f02762dda1d", // MOOI
  "0x4b91c67a89d4c4b2a4ed9fcde6130d7495330972", // TRCL
  "0x4b96dbf8f42c8c296573933a6616dcafb80ca461", // oTON
  "0x4d87baa66061a3bb391456576cc49b77540b9aa9", // DLP
  "0x4ec5e1c092f9c40d1e9be5744feddb23935232e9", // APM
  "0x50ca1ce4ade3d465baeb611e934c5c8e752f22c3", // DCB
  "0x52f4c436c9aab5b5d0dd31fb3fb8f253fd6cb285", // oCBANK
  "0x533c42dc2f9339320dae82a44facf00efc60a68c", // amKSP
  "0x549455b9fe3bd53a64e49726b27eb08a92835177", // oMUDOL2
  "0x5655ee0628ad3348cb7b60e8102680bb0d7f0de1", // BOMUL
  "0x5844b02cc0ab5d5a18be7dde4e245f5edec449ce", // ksAPPLE
  "0x588c62ed9aa7367d7cd9c2a9aaac77e44fe8221b", // AGOV
  "0x5a55a1cd5cc5e89019300213f9faf20f57361d43", // JUN
  "0x5ab03cdb98ec84846a418d4c7cb1d481a1ef5818", // CNT
  "0x5ab30f1642e0aed47664635a305b9f778088b4cb", // VEVE
  "0x6026c432c420dce0e7bc5f84b9df1637b9ce953b", // sigKSP
  "0x604d6a7c492b4953bd20e007c7220d6c3d867fc5", // TOX
  "0x6455c2772116da0a067687153bec12528cc804e9", // KMCM
  "0x67cb285790bb9f5dce728f80a3104a2297df2bb2", // oWEMIX
  "0x69df45d36341f6bad3c4beffb9e77f2b74709c40", // JUNS
  "0x6bae4b6afc2856b4ac0fb1165cf85c4923302ba2", // PLWI
  "0x6cef6dd9a3c4ad226b8b66effeea2c125df194f1", // AZIT
  "0x6f818355f9a64692905291e9a3c8f960edcf117d", // BTRY
  "0x78e5c7380cd1ecf27bb1234df7633d998eb71cfc", // KOP
  "0x78f3c81c5f6c8964aea1a48309dccb837526af56", // oPBOS
  "0x79bb4d71f6c168531a259dd6d40a8d5de5a34427", // MARD
  "0x7a85836f66dbbd53f457855de243f5aa28051e33", // ksSOL
  "0x7c625f150f3b3c1d0dc750ce6bb4ca7352c98c38", // HOOF
  "0x7f1712f846a69bf2a9dbc4d48f45f1d52ca32e28", // UFO
  "0x800800500fd721a2e8092bd2d0401841b33b0fe7", // oMEGA
  "0x807c4e063eb0ac21e8eef7623a6ed50a8ede58ca", // EKL
  "0x8160a0d5e6121fefbf245795079ba8551b6ae008", // cKONGZ
  "0x87fa550a58325127952e38863880fb15fe86500e", // MAYO
  "0x88bfd174f9076519a45979ce3122bc15883c0691", // ksCOINBASE
  "0x8bb947a446048f9b608bb9ea3006d8ac9ea386a7", // sMoksha
  "0x8c783809332be7734fa782eb5139861721f77b33", // TURK
  "0x8ea00f38b4bf5ed6997ba53769ff9cdd948e43bb", // SYM
  "0x8ff0586b6eea63a35e73d09237b4a58b3056f274", // oBIOT
  "0x945f68b51cc51709f771e7104990b3f8a3c3ec79", // DRB
  "0x946bc715501413b9454bb6a31412a21998763f2d", // KBT
  "0x94a2a6308c0a3782d83ad590d82ff0ffcc515312", // SIG
  "0x99b5e2571c4d9fa1ccc5ce19d1a515e3ddfb5b2e", // DBY
  "0x9a8ce99db3c298b1f3fa0ffba752ba95157c6f76", // vvCLA
  "0x9d52704cd67d586ed2870d810b0cef2cc168ae42", // ZEMIT
  "0xa006ba407cfc6584c90bac24ed971261885a0fd6", // oMATIC
  "0xa479bf71ded32fcb26b4510787352614c56c5184", // DTC
  "0xa8598d1d1e6e5ecf03fc236df3561d276038c174", // MON
  "0xad27ace6f0f6cef2c192a3c8f0f3fa2611154eb3", // MPWR
  "0xaeeca95c899660dc74886168d0ffdebf3669179d", // oXDT
  "0xb49e754228bc716129e63b1a7b0b6cf27299979e", // STONE
  "0xb57e0038e8027c3de8126a07cac371f31c9c229e", // aKAI
  "0xba9725eaccf07044625f1d232ef682216f5371c2", // CLAM
  "0xcc8088361c6f6ea58ce2d121f84afb2115d12cc5", // HSC
  "0xcd8fe44a29db9159db36f96570d7a4d91986f528", // AVAX
  "0xce40569d65106c32550626822b91565643c07823", // KASH
  "0xcf87f94fd8f6b6f0b479771f10df672f99eada63", // CLA
  "0xd01d650a5920fc714b2f8ed9d53e3ffc663302e9", // oDKA
  "0xd109065ee17e2dc20b3472a4d4fb5907bd687d09", // KLAP
  "0xd284a439c6b488903fe7d293226fc6d84972882c", // ASD
  "0xd6243f133ebf7ea191fb0eb47017b809b46b15f1", // ZTC
  "0xd675dae87d8740b2163b4e232ee51a880495e6c7", // JUNC
  "0xd83b9dfa49d6c6d2a69554576e712e45a8a13e49", // EKLP
  "0xdb116e2dc96b4e69e3544f41b50550436579979a", // KFI
  "0xdcd9c56af7c05194d3a8c4187262130759e91320", // LBK
  "0xdf9e1b5a30d6175cabaaf39964dd979e84753eb1", // INS
  "0xdfc05e7a28ed3a1c22bc7c22383764a4732ead23", // ksETH
  "0xe0f2a679390efb0507ae8f99db4b7832202ac808", // KIDS
  "0xe1376ab327b6deb7bebaee1329eb94574d51a8d9", // KPs
  "0xe7a1b580942148451e47b92e95aeb8d31b0aca37", // DFKGOLD
  "0xe7d3b78f032e70fabfdb8c0741ea74f775deb32d", // KSTA
  "0xe91ffe2e15ccd56b1b8ddf7cdf848dfee6b5a858", // ENRG
  "0xe950bdcfa4d1e45472e76cf967db93dbfc51ba3e", // KAI
  "0xf445e3d0f88c4c2c8a2751180ae4a525789cfe32", // bus
  "0xf4546e1d3ad590a3c6d178d671b3bc0e8a81e27d", // sBWPM
  "0xf80f2b22932fcec6189b9153aa18662b15cc9c00", // stKLAY
  "0xe4f05a66ec68b54a58b17c22107b02e0232cc817", // WKLAY
  "0x6270b58be569a7c0b8f47594f191631ae5b2c86c", // USDC
  "0xd6dab4cff47df175349e6e7ee2bf7c40bb8c05a3", // USDT
  "0xdcbacf3f7a069922e677912998c8d57423c37dfa", // WBTC
  "0xcd6f29dc9ca217d0973d3d21bf58edd3ca871a86", // WETH
  "0x078db7827a5531359f6cb63f62cfa20183c4f10c", // DAI
  "0xff3e7cf0c007f919807b32b30a4a9e7bd7bc4121", // WKLAY_2
  "0x54640a6b9f5a6b0eae043f0a6fd69a4431323356", // KCD
  "0x11dE1Dc62933C66E45abB2cE7a1f780884957AE4", // Ripple
  "0x280162B14ACf85d5646eA21cc2b6460A6c891BD4", // oBTC-B
  "0x37d46C6813B121d6A27eD263AeF782081ae95434", // sKAI
  "0x44efe1EC288470276E29ac3AdB632BFF990E2E1F", // vKAI
  "0x4B96dBf8f42C8c296573933a6616dcAfb80Ca461", // oTON
  "0x56A8Bda5210008DbaB60f8bD9E34e42499c05800", // USDT
  "0x67CB285790Bb9F5DcE728f80A3104a2297Df2BB2", // oWEMIX
  "0x7d8142a696dDbB8eAAA937696C35772190B234cb", // oUSDT-B
  "0xA006Ba407cFC6584C90bAC24eD971261885A0Fd6", // oMATIC
  "0xB57E0038e8027C3dE8126a07cAc371f31c9c229E", // aKAI
  "0xE4A1bd45CDDBBD5d9f605B08Ed13a94b6B6ab5AA", // CYCON
  "0xF4546E1D3aD590a3c6d178d671b3bc0e8a81e27d", // sBWPM
  "0xFf47a1aFfC365B192337326C2EdC83a48A959e38", // kakao
  "0xb3B1B54e3B9a27cEe606f1018760ABec4274BD35", // PEARL
  "0xbA9725eaCCF07044625F1D232eF682216F5371c2", // CLAM
  "0xd3f78c32aF988d67C16F02C3631bf4047ffdA617", // oETH-B
];

const STABLE_COINS: string[] = [
  "0x754288077D0fF82AF7a5317C7CB8c444D421d103", // oUSDC
  "0xceE8FAF64bB97a73bb51E115Aa89C17FfA8dD167", // oUSDT
  "0x210bc03f49052169d5588a52c317f71cf2078b85", // oBUSD
  "0x6270b58be569a7c0b8f47594f191631ae5b2c86c", // USDC
  "0xd6dab4cff47df175349e6e7ee2bf7c40bb8c05a3", // USDT
  "0x56A8Bda5210008DbaB60f8bD9E34e42499c05800", // USDT
  "0x7d8142a696dDbB8eAAA937696C35772190B234cb", // oUSDT-B
];

export function sqrtPriceX96ToTokenPrices(
  sqrtPriceX96: bigint,
  token0: Token,
  token1: Token,
): number[] {

  const decimal0 = Number(token0.decimals);
  const decimal1 = Number(token1.decimals);
  const price0 = (Number(sqrtPriceX96) / 2**96)**2 / (10**decimal1 / 10**decimal0);
  const price1 = (1 / price0);

  return [price0, price1];
}


export async function getklayPriceinUSD(): Promise<number> {
  // fetch eth prices for each stablecoin

  return 1;
  // const usdcPool = await Pool.get(USDC_WKLAY_03_POOL); // dai is token0
  // if (usdcPool !== undefined) {
  //   return usdcPool.token0Price;
  // } else {
  //   return 0;
  // }
  // let klayPrice = 0
  // let usdtPrice = 0

  // get klay/usdt from bithumb
  // request({url:'https://api.bithumb.com/public/ticker/BTC_KRW', method:'GET'}, function(err:any, resp:any, body:any) {
  //   klayPrice = Number(JSON.parse(body).data.closing_price)
  // })
  // request({url:'https://api.bithumb.com/public/ticker/BTC_KRW', method:'GET'}, function(err:any, resp:any, body:any) {
  //   usdtPrice = Number(JSON.parse(body).data.closing_price)
  // })
  // axios.get("https://api.bithumb.com/public/ticker/KLAY_KRW").then(async response => {
  //   klayPrice = Number(response.data.closing_price)
  // })
  // axios.get("https://api.bithumb.com/public/ticker/USDT_KRW").then(async response => {
  //   usdtPrice = Number(response.data.closing_price)
  // })
  // 
  // return klayPrice / usdtPrice
}


/**
 * Search through graph to find derived Eth per token.
 * @todo update to be derived KLAY (add stablecoin estimates)
 **/

export async function findKlayPerToken(token: Token): Promise<number> {
  if (token.id == WKLAY_ADDRESS || token.id == ADDRESS_ZERO) {
    return ONE_BD.toNumber();
  }
  // for now just take USD from pool with greatest TVL
  // need to update this to actually detect best rate based on liquidity distribution
  let priceSoFar = 0;
  const bundle = await Bundle.get("1");

  const tokenWhitelist = await WhiteListPools.getByTokenId(token.id);
  // hardcoded fix for incorrect rates
  // if whitelist includes token - get the safe price
  assert(bundle);
  assert(tokenWhitelist);
  let largestLiquidityKLAY = 0;
  // get a list of whitelist For the matching token
  for (let i = 0; i < tokenWhitelist.length; ++i) {
    const poolAddress = tokenWhitelist[i].poolId;
    const pool = await Pool.get(poolAddress);
    if (pool === undefined) {
      const v2pool = await V2Pool.get(poolAddress);
      if (v2pool === undefined) {
        assert(undefined)
      }
      assert(v2pool?.tokenAId); assert(v2pool?.tokenBId);
      if (v2pool.tokenAId == token.id) {
        const tokenB = await Token.get(v2pool.tokenBId); assert(tokenB)
        const totalValueLockedTokenB = convertTokenToDecimal(BigNumber.from(v2pool.liquidityB), tokenB.decimals)
        if (totalValueLockedTokenB >= 0) {
          const klayLocked = Math.floor(totalValueLockedTokenB*tokenB.derivedKLAY);
          if ((klayLocked > largestLiquidityKLAY) && klayLocked > MINIMUM_KLAY_LOCKED) {
            largestLiquidityKLAY = klayLocked;
            priceSoFar = v2pool.tokenAPrice * tokenB.derivedKLAY // tokenB per our token * KLAY per tokenB
          }
        }
      }
      if (v2pool.tokenBId == token.id) {
        const tokenA = await Token.get(v2pool.tokenAId); assert(tokenA)
        const totalValueLockedTokenA = convertTokenToDecimal(BigNumber.from(v2pool.liquidityA), tokenA.decimals)
        if (totalValueLockedTokenA >= 0) {
          const klayLocked = Math.floor(totalValueLockedTokenA*tokenA.derivedKLAY);
          if ((klayLocked > largestLiquidityKLAY) && klayLocked > MINIMUM_KLAY_LOCKED) {
            largestLiquidityKLAY = klayLocked;
            priceSoFar = v2pool.tokenBPrice * tokenA.derivedKLAY // tokenA per our token * KLAY per tokenA
          }
        } 
      }
    } else {
      assert(pool.token0Id); assert(pool.token1Id);
      if (!BigNumber.from(pool.liquidity).gt(ZERO_BI)) {
        return priceSoFar
      }

      // whitelist token is token1
      if (pool.token0Id == token.id) {
        const token1 = await Token.get(pool.token1Id); assert(token1);
        const klayLocked = Math.floor(Number(pool.totalValueLockedToken1)*token1.derivedKLAY);
        if (klayLocked > largestLiquidityKLAY && klayLocked > MINIMUM_KLAY_LOCKED) {
          largestLiquidityKLAY = klayLocked;
          priceSoFar = pool.token0Price * token1.derivedKLAY // token1 per our token * KLAY per token1
        }
      }
      if (pool.token1Id == token.id) {
        const token0 = await Token.get(pool.token0Id); assert(token0);
        const klayLocked = Math.floor(Number(pool.totalValueLockedToken0)*token0.derivedKLAY); // get the derived KLAY in
        if (klayLocked > largestLiquidityKLAY && klayLocked > MINIMUM_KLAY_LOCKED) {
          largestLiquidityKLAY = klayLocked;
          priceSoFar = pool.token1Price * token0.derivedKLAY // token0 per our token * KLAY per token0
        }
      }
    }

  }
  return priceSoFar; // nothing was found return 0
}

/**
 * Accepts tokens and amounts, return tracked amount based on token whitelist
 * If one token on whitelist, return amount in that token converted to USD * 2.
 * If both are, return sum of two amounts
 * If neither is, return 0
 */
export async function getTrackedAmountUSD(
  tokenAmount0: number,
  token0: Token,
  tokenAmount1: number,
  token1: Token
): Promise<number> {
  const bundle = await Bundle.get("1");
  const returnAmountScale = ZERO_BD;
  assert(bundle);
  const price0USD = token0.derivedKLAY * bundle.klayPriceUSD; 
  const price1USD = token1.derivedKLAY * bundle.klayPriceUSD; 


  // both are whitelist tokens, return sum of both amounts
  if (
    WHITELIST_TOKENS.includes(token0.id) &&
    WHITELIST_TOKENS.includes(token1.id)
  ) {

    return tokenAmount0*price0USD + tokenAmount1 * price1USD
  }

  // take double value of the whitelisted token amount
  if (
    WHITELIST_TOKENS.includes(token0.id) &&
    !WHITELIST_TOKENS.includes(token1.id)
  ) {
    return tokenAmount0*price0USD*2
  }

  // take double value of the whitelisted token amount
  if (
    !WHITELIST_TOKENS.includes(token0.id) &&
    WHITELIST_TOKENS.includes(token1.id)
  ) {
    return tokenAmount1*price1USD*2
  }

  // neither token is on white list, tracked amount is 0
  return 0;
}
