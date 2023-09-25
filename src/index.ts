import * as fs from "node:fs";
import {
    MnemonicWallet,
    WalletHandler,
    FileUploadHandler,
    cryptString,
    genIv,
    genKey,
    StorageHandler,
} from "@jackallabs/jackal.nodejs";
import type {
    IFileDownloadHandler,
    IUploadList,
    IWalletHandler,
} from "@jackallabs/jackal.nodejs";

import {
    // IStray,
    IPayData,
    IStoragePaymentInfo,
} from "@jackallabs/jackal.nodejs";

import ErrnoException = NodeJS.ErrnoException;

const mnemonic =
    "capital chunk piano supreme photo beef age boy retire vote kitchen under";

//     - name: Tester1
//   type: local
//   address: jkl1rljdn92auk5ud8qeprztdudz3lrqdzdkga5p8y
//   pubkey: '{"@type":"/cosmos.crypto.secp256k1.PubKey","key":"Aquw7ZvVmbCI7y4cpaRgZp49O6sj3CbRnUFeRUVJhs8N"}'
//   mnemonic: ""

//  const mnemonic = "dune seminar obscure diet real pupil arm transfer body give wonder replace bounce multiply turn recycle differ pride cruel grunt crane word hub moon"

const fileName = "app.toml3.txt";
const sampleDir = "Node3";
const runVerify = true;
// const runVerify = false
// const downloadOnly = true
const downloadOnly = false;

const signerChain = "lupulella-2";
// const testnet = {
//     signerChain,
//     queryAddr: "http://ec2-3-101-117-237.us-west-1.compute.amazonaws.com:1317",
//     txAddr: "http://ec2-3-101-117-237.us-west-1.compute.amazonaws.com",
// };

// 1317 : query port
// 26657 : txaddr port


const testnet = {
    signerChain,
    queryAddr: "https://testnet-grpc.jackalprotocol.com",
    txAddr: "https://testnet-rpc.jackalprotocol.com",
};



async function verifyCrypt() {
    const iv = genIv();
    const key = await genKey();
    const test = "hello world";
    const enc = await cryptString(test, key, iv, "encrypt");
    console.log("enc:", enc);
    const dec = await cryptString(enc, key, iv, "decrypt");
    console.log("dec:", dec);
}

export type CheckStorageResult = {
    isExpired: boolean;
    noFreeSpace: boolean;
};

async function checkStorage(): Promise<CheckStorageResult> {
    const wallet = await getWallet();
    console.log({ walletHandler: wallet });
    const storage = await StorageHandler.trackStorage(wallet);

    console.log(">>>> checkStorage::", { storage });

    // const strays: IStray[] = await storage.getAllStrays();
    const walletAddr = wallet.getJackalAddress();

    const freeSpace: number = await storage.getClientFreeSpace(walletAddr);
    const payData: IPayData = await storage.getPayData(walletAddr);
    const paymentInfo: IStoragePaymentInfo =
        await storage.getStoragePaymentInfo(walletAddr);

    console.log("Storage data : ", {
        freeSpace,
        payData,
        paymentInfo,
        // strays,
    });

    if (paymentInfo.end) {
        let isExpired = Date.now() >= paymentInfo.end?.valueOf();

        let noFreeSpace = freeSpace < 2400000; //? ~~  2mb

        return {
            isExpired,
            noFreeSpace,
        };
    } else {
        throw new Error("Failed to get paymentInfo for <" + walletAddr + ">");
    }
}

async function buyStorage(): Promise<any> {
    const wallet = await getWallet();
    const storage = await StorageHandler.trackStorage(wallet);
    const walletAddr = wallet.getJackalAddress();

    const response = await storage.buyStorage(walletAddr, 1, 2);
    console.log(">>>>>> buyStorage result: ", { response });

    return response;
}

async function getWallet(): Promise<IWalletHandler> {
    
    const m = await MnemonicWallet.create(mnemonic);
    console.log('>>>> getWallet :: m ', {m});
    const w = await WalletHandler.trackWallet(testnet, m);

    console.log('>>>> getWallet :: w ', {w});

    console.log("Wallet pubKey: = ", await w.getAccounts());

    const allBal = await w.getAllBalances();
    const jklBal = await w.getJackalBalance();
    const jklAddr = w.getJackalAddress();

    console.log(">> checking address, balances", {
        allBal,
        jklBal,
        jklAddr,
    });

    return w;
}

async function run() {
    // const m = await MnemonicWallet.create(mnemonic)
    // const w = await WalletHandler.trackWallet(testnet, m)

    const w = await getWallet();

    const fileIo = await w.makeFileIoHandler("1.1.x");
    if (!fileIo) throw new Error("no FileIo");

    fileIo.forceProvider({
        address: "string",
        ip: "https://testnet5.jwillette.net",
        totalspace: "string",
        burnedContracts: "string",
        creator: "string",
        keybaseIdentity: "string",
        authClaimers: [],
    });

    await fileIo.generateInitialDirs(null, [sampleDir]);

    await fileIo.verifyFoldersExist([sampleDir]);
    const dir = await fileIo.downloadFolder("s/" + sampleDir);

    fs.readFile(
        `./test-files/${fileName}`,
        async function (err: ErrnoException | null, f: Buffer) {
            if (err) console.error(err);
            const toUpload = new File([f], fileName, { type: "text/plain" });

            // @ts-ignore
            const handler = await FileUploadHandler.trackFile(
                toUpload,
                dir.getMyPath()
            );

            const uploadList: IUploadList = {};
            uploadList[fileName] = {
                data: null,
                exists: false,
                handler: handler,
                key: fileName,
                uploadable: await handler.getForUpload(),
            };

            console.log('>>>>> uploadList', {uploadList})

            const tracker = { timer: 0, complete: 0 };
            await fileIo.staggeredUploadFiles(uploadList, dir, tracker);
            console.log('>>>>> done upload', {dir, fileName})
            const dirAgain = await fileIo.downloadFolder("s/" + sampleDir);
            const dl = (await fileIo.downloadFile(
                {
                    rawPath: dirAgain.getMyChildPath(fileName),
                    owner: w.getJackalAddress(),
                },
                {
                    track: 0,
                }
            )) as IFileDownloadHandler;

            fs.writeFileSync(
                `./test-files/dl/${fileName}`,
                new Uint8Array(await dl.receiveBacon().arrayBuffer()),
                {}
            );
        }
    );
}

async function tryDownload() {
    const m = await MnemonicWallet.create(mnemonic);
    const w = await WalletHandler.trackWallet(testnet, m);
    const fileIo = await w.makeFileIoHandler("1.1.x");
    if (!fileIo) throw new Error("no FileIo");

    const dirAgain = await fileIo.downloadFolder("s/" + sampleDir);
    const dl = (await fileIo.downloadFile(
        {
            rawPath: dirAgain.getMyChildPath(fileName),
            owner: w.getJackalAddress(),
        },
        {
            track: 0,
        }
    )) as IFileDownloadHandler;

    fs.writeFileSync(
        `./test-files/dl/${fileName}`,
        new Uint8Array(await dl.receiveBacon().arrayBuffer()),
        {}
    );
}

// getWallet();

(async function () {

    // return;
    if (runVerify) {
        await verifyCrypt().then(() => {
            console.log("verifyCrypt() Done");
        });
    }

    let resCheckStorage = undefined;
    try {
        resCheckStorage = await checkStorage();
        console.log(">>>>>>> resCheckStorage ", { resCheckStorage });
    } catch (ex) {
        console.log(">>>> Exception at checkStorage:", { ex });
    }

    // return;

    if (
        resCheckStorage &&
        (resCheckStorage.isExpired === true ||
            resCheckStorage.noFreeSpace === true)
    ) {
        try {
            await buyStorage();
        } catch (ex) {
          console.error('>>> Exception at buyStorage >>>', ex);
        }
    }

    if (downloadOnly) {
        await tryDownload().then(() => {
            console.log("tryDownload() Done");
        });
    } else {
        await run().then(() => {
            console.log("run() Done");
        });
    }
})();
