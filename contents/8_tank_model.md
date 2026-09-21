# 第8回　河川・ダムモデルの発展

## 今回の位置付け

$$
\text{現象の理解}
\rightarrow
\underline{\text{仮定の設定}}
\rightarrow
\underline{\text{数理モデルの構築}}
\rightarrow
\text{数値シミュレーション}
\rightarrow
\text{データとの比較}
\rightarrow
\underline{\text{パラメタ推定}}
\rightarrow
\underline{\text{モデルの検証と改善}}
$$

第6回では，流入量と放流量をどちらも観測データとして与え，貯水量の変化を保存則だけで計算した．
第7回では，観測データからパラメタを推定する方法を学んだ．
今回はこの2つを組み合わせ，「データとして与えていた量そのものをモデル化する」段階に進む．
流出量を貯水量の関数として表す，降水量から流入量を作り出す，という2つの発展を通じて，モデルを複雑にすることの利点と不利益を確かめる．

## 今回の到達目標

- 流出量を観測データとして与えるモデルと，$Q_{\mathrm{out}} = kV$ のように貯水量の関数としてモデル化するモデルを，同じデータで比較できる
- 降水量を入力とするタンクモデル $S' = P(t) - kS$，$Q = kS$ を，保存則と「流出は貯留量に比例する」という仮定から構築できる
- 降水量 mm/日 を流域面積を使って水量 千m³/日 に換算できる
- タンクモデルのパラメタを`least_squares`で推定し，観測された流入量と比較できる
- パラメタを増やしたモデルについて，当てはまりの改善と，説明可能性や推定の安定性の低下を，数値をもとに議論できる

**今回の流れ**（105分の目安）

| 段階 | 内容 | 時間 |
| --- | --- | --- |
| 1 | 第6回・第7回の復習，降水量データの確認（演習0） | 10分 |
| 2 | 流出のモデル化，タンクモデルの仮定と導出，単位の換算 | 25分 |
| 3 | 放流量のモデル化の比較，タンクモデルの実装と推定 | 20分 |
| 4 | パラメタの意味，応答の速さ，2段タンクとの比較（演習1〜4） | 35分 |
| 5 | 複雑化の利点と不利益の議論，まとめ，課題の説明 | 15分 |

## 前回の復習と今回の位置付け

第6回のモデル $V' = Q_{\mathrm{in}}(t) - Q_{\mathrm{out}}(t)$ では，右辺の2つの量はどちらも「外から与えられるデータ」だった．
モデルは保存則を表すだけで，流入や流出がなぜその値になるのかは何も説明していない．

しかし，モデルを使う目的によっては，それでは足りない．

- 放流量のデータがない自然の湖や，操作されていない河川区間では，流出量はそこに貯まっている水の量で決まる．流出量を状態変数の関数として表す必要がある
- 「来週大雨が降ったら流入量はどうなるか」に答えるには，降水量から流入量を作り出す仕組みがモデルの中に必要である

どちらも，これまで観測データとして外から与えていた量に，仮定を置いてモデルの中に取り込む作業である．
仮定が増えるので，モデルは現象をより多く説明できるようになるが，同時に間違える余地も増える．

## 準備

````{note} 演習0：作業フォルダとNotebookを作成する

1. ターミナルで第8回の作業フォルダを作成する．

```bash
mkdir -p ~/applied_programming_ii/08
cd ~/applied_programming_ii/08
mkdir -p notebooks reports/figures
```

2. 講義サイトの[授業用データ一覧](../data/README.md)から`precipitation_chichibu_daily.csv`をダウンロードし，`~/applied_programming_ii/data/`に置く．`dam_urayama_daily.csv`は第6回のものを使う．

3. `notebooks/tank_model.ipynb`を新規作成する．

4. `08`フォルダに`README.md`を作り，次の内容を記入する．

```markdown
# 応用プログラミングII 第8回

- 氏名：
- 学籍番号：

## 今日の目標

流出量と流入量を観測データではなく仮定でモデル化し，単純なモデルと発展モデルを同じデータで比較する．

## 降水量データの確認

- 出典・観測地点：
- 期間：
- 単位：
- 欠測の扱い：

## 演習1：放流量を kV で表したときの結果

## 演習2：k を変えたときの応答

| k [1/日] | 平均滞留時間 1/k [日] | ピーク流出量 | ピークの遅れ |
| --- | --- | --- | --- |

## 演習3・4の記録

## 課題1

## 課題2の考察
```

5. Notebookの最初のコードセルに以下を入力し，実行できることを確認する．

```python
from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from scipy.integrate import solve_ivp
from scipy.optimize import least_squares

PROJECT_DIR = Path.home() / "applied_programming_ii" / "08"
DATA_DIR = Path.home() / "applied_programming_ii" / "data"
FIGURE_DIR = PROJECT_DIR / "reports" / "figures"
FIGURE_DIR.mkdir(parents=True, exist_ok=True)

print("作業フォルダ:", PROJECT_DIR)
print("ダムデータの有無:", (DATA_DIR / "dam_urayama_daily.csv").exists())
print("降水量データの有無:", (DATA_DIR / "precipitation_chichibu_daily.csv").exists())
```
````

## 導入：雨が降ると，いつ，どれだけ流れ込むか

### 降水量データ

降水量は気象庁の秩父観測所（気象官署）の日降水量を使う．
浦山ダムの集水域は秩父市内にあるが，観測所は流域の外にあり，流域全体に同じ雨が降ったとみなすのは近似である．
データの出典と加工内容は[授業用データ一覧](../data/README.md)にある．

```python
dam = pd.read_csv(DATA_DIR / "dam_urayama_daily.csv", parse_dates=["date"])
rain = pd.read_csv(DATA_DIR / "precipitation_chichibu_daily.csv", parse_dates=["date"])

print(rain.head())
print("降水量の期間:", rain["date"].min().date(), "〜", rain["date"].max().date(), " 行数:", len(rain))
print("欠損値の数:", rain["precipitation_mm"].isna().sum())
print("年ごとの降水量の合計 [mm]:")
print(rain.groupby(rain["date"].dt.year)["precipitation_mm"].sum().round(0))
```

2019年を対象とし，ダムのデータと日付で結合する．

```python
year = 2019
dam_year = dam[dam["date"].dt.year == year].reset_index(drop=True)
rain_year = rain[rain["date"].dt.year == year].reset_index(drop=True)
data = pd.merge(dam_year, rain_year, on="date", how="inner")
print("結合後の行数:", len(data))

SECONDS_PER_DAY = 24 * 60 * 60


def m3s_to_1000m3_per_day(flow_m3s):
    """流量 [m^3/s] を [千m^3/日] に換算する．"""
    return flow_m3s * SECONDS_PER_DAY / 1000


t_data = np.arange(len(data), dtype=float)                       # 1月1日を0とした日数 [日]
qin_obs = m3s_to_1000m3_per_day(data["inflow_m3s"].values)       # 観測流入量 [千m^3/日]
qout_obs = m3s_to_1000m3_per_day(data["outflow_m3s"].values)     # 観測放流量 [千m^3/日]
rain_obs = data["precipitation_mm"].values                       # 日降水量 [mm/日]

fig, axes = plt.subplots(2, 1, figsize=(8, 6), sharex=True)
axes[0].bar(data["date"], rain_obs, color="tab:blue", width=1.0)
axes[0].invert_yaxis()
axes[0].set_ylabel("Precipitation [mm/day]")
axes[0].set_title(f"Chichibu precipitation and Urayama Dam inflow, {year}")
axes[1].plot(data["date"], qin_obs, color="tab:green")
axes[1].set_ylabel("Inflow [1000 m^3/day]")
axes[1].set_xlabel("Date")
for ax in axes:
    ax.grid(True)
fig.tight_layout()
fig.savefig(FIGURE_DIR / f"rain_inflow_{year}.png", dpi=150)
plt.show()
```

雨が降った日に流入量が増え，雨が止んだ後も数日かけて減っていく．
雨と流入の間には，大きさの対応だけでなく，時間の遅れと引き延ばしがある．
この「遅れて，なだらかに流れ出る」性質を表すのが今回のモデルである．

## 発展1：流出量を貯水量の関数として表す

### 2つのモデル

第6回のモデルでは放流量を観測データで与えた．
これを**モデルA**とする．

$$
\text{モデルA：}\quad \frac{dV}{dt} = Q_{\mathrm{in}}(t) - Q_{\mathrm{out}}^{\mathrm{obs}}(t)
$$

これに対し，「流出量は貯まっている水の量に比例する」という仮定を置いたものを**モデルB**とする．

$$
\text{モデルB：}\quad \frac{dV}{dt} = Q_{\mathrm{in}}(t) - kV
$$

$k$ の単位は 1／日 で，貯水量のうち1日に流れ出る割合を表す．
この仮定は，底に穴の開いた容器から水が漏れる場合や，湖から自然に川へ流れ出る場合に近い．
モデルBには放流量のデータが要らない代わりに，パラメタ $k$ を決める必要がある．

貯水位から貯水量への換算には，第7回で推定した傾き $\alpha \approx 1027$ 千m³/m を使う．

```python
LEVEL_MIN = 304.0
ALPHA = 1027.0      # 第7回で推定した貯水位1 mあたりの貯水量 [千m^3/m]

V_obs = ALPHA * (data["water_level_m"].values - LEVEL_MIN)    # 観測貯水量 [千m^3]


def model_a_rhs(t, V, t_data, qin_data, qout_data):
    """モデルA dV/dt = Q_in(t) - Q_out_obs(t)．放流量は観測データ．"""
    return np.interp(t, t_data, qin_data) - np.interp(t, t_data, qout_data)


def model_b_rhs(t, V, t_data, qin_data, k):
    """モデルB dV/dt = Q_in(t) - k V．放流量は貯水量に比例すると仮定．"""
    return np.interp(t, t_data, qin_data) - k * V


# モデルBの k の目安：観測された放流量と貯水量の比の平均
k_guess = np.mean(qout_obs / V_obs)
print(f"k の目安（放流量/貯水量 の平均）: {k_guess:.5f} /日,  平均滞留時間 1/k = {1 / k_guess:.0f} 日")

sol_a = solve_ivp(model_a_rhs, (t_data[0], t_data[-1]), [V_obs[0]], t_eval=t_data, args=(t_data, qin_obs, qout_obs), max_step=1.0)
sol_b = solve_ivp(model_b_rhs, (t_data[0], t_data[-1]), [V_obs[0]], t_eval=t_data, args=(t_data, qin_obs, k_guess), max_step=1.0)

rmse_a = np.sqrt(np.mean((sol_a.y[0] - V_obs) ** 2))
rmse_b = np.sqrt(np.mean((sol_b.y[0] - V_obs) ** 2))
print(f"モデルA（放流量は観測データ）の RMSE: {rmse_a:8.0f} 千m^3")
print(f"モデルB（放流量 = kV）の RMSE:        {rmse_b:8.0f} 千m^3")
```

```python
fig, ax = plt.subplots(figsize=(8, 4.5))
ax.plot(data["date"], V_obs, color="black", marker="o", markersize=2, linestyle="none", label="observed (from water level)")
ax.plot(data["date"], sol_a.y[0], color="tab:green", label="model A: outflow from data")
ax.plot(data["date"], sol_b.y[0], color="tab:red", linestyle="--", label=f"model B: outflow = kV (k = {k_guess:.4f} /day)")
ax.set_title(f"Urayama Dam {year}: two ways of treating the outflow")
ax.set_xlabel("Date")
ax.set_ylabel("Storage [1000 m^3]")
ax.grid(True)
ax.legend()
fig.tight_layout()
fig.savefig(FIGURE_DIR / f"outflow_models_{year}.png", dpi=150)
plt.show()
```

モデルBの RMSE はモデルAの20倍以上になり，貯水量の季節変化をまったく再現できない．
浦山ダムの放流量は，発電や水道への供給計画，洪水期の水位制限に従って人が決めている量であり，貯水量に比例してはいない．
「流出は貯留量に比例する」という仮定は自然の湖には向いていても，操作されるダムには向かない．
モデルの仮定は，現象の仕組みに合わせて選ぶ必要がある．

````{note} 演習1：k を推定しても救えないことを確かめる

1. `least_squares`でモデルBの $k$ を推定する．残差関数は`residuals_model_b(theta, t_data, qin_data, V_obs)`とし，`bounds=([0.0], [1.0])`を付ける．
2. 推定した $k$ での RMSE をモデルAと比べる．推定しても RMSE が大きいままなのはなぜか．
3. 放流量の観測値と貯水量の観測値を横軸・縦軸にした散布図を描き，両者に比例関係があるかを確かめる．
````

```{dropdown} 演習1の確認
$k$ を推定しても RMSE は約11,700千m³で，目安の値のときとほとんど変わらない．
推定は「モデルBの中で最も合う $k$」を見つけるだけであり，モデルBの構造が現象に合っていなければ改善しない．
散布図を描くと，放流量は貯水量とほとんど無関係に，季節や日によって決まっていることが分かる．
第7回の言葉で言えば，これはパラメタ推定の誤差ではなくモデルの構造による誤差である．
```

## 発展2：降水量から流入量を作るタンクモデル

### 仮定

ダムより上流の集水域を，1つの容器（タンク）と考える．

- 集水域に降った雨のうち，一定の割合 $c$ がタンクに入る．残りは蒸発や地下深くへの浸透で失われる
- タンクからの流出量は，タンクに貯まっている水の量 $S$ に比例する．比例係数を $k$ とする
- タンクから流れ出た水が，そのままダムへの流入量になる

状態変数はタンクの貯留量 $S(t)$，外部入力は降水量 $P(t)$，パラメタは $c$ と $k$ である．
発展1で見たとおり「流出は貯留量に比例する」という仮定は操作されるダムには合わなかったが，人が操作していない集水域の流出にはもっともらしい仮定である．

### 単位の換算

降水量の単位は mm/日 であり，これを水量 千m³/日 に直すには流域の面積を掛ける．
浦山ダムの集水面積は $A = 51.6$ km² である．

1 mm の雨が 1 km² に降ると，その水量は $0.001\ \mathrm{m} \times 10^6\ \mathrm{m^2} = 1000\ \mathrm{m^3} = 1$ 千m³ である．
したがって，

$$
1\ \mathrm{mm}/\text{日} \times 51.6\ \mathrm{km^2} = 51.6\ \text{千}\mathrm{m^3}/\text{日}
$$

となり，降水量に集水面積の数値をそのまま掛ければ 千m³/日 になる．

```python
AREA_KM2 = 51.6    # 浦山ダムの集水面積 [km^2]

rain_volume = rain_obs * AREA_KM2      # 流域に降った雨の水量 [千m^3/日]

print(f"2019年の年間降水量: {rain_obs.sum():.0f} mm")
print(f"流域に降った雨の年間水量: {rain_volume.sum():9.0f} 千m^3")
print(f"観測された年間流入量:     {qin_obs.sum():9.0f} 千m^3")
print(f"流入量 / 降雨量 の比:     {qin_obs.sum() / rain_volume.sum():.2f}")
print(f"台風の日（10月12日）の降雨の水量: {rain_volume[t_data == 284][0]:.0f} 千m^3/日")
```

年間で見ると，流域に降った雨の量とダムへの流入量はほぼ同じ大きさである．
秩父の雨が流域の雨を代表しているとは限らないので，この比は偶然の一致も含むが，単位の換算が正しいことの目安になる．

### 微分方程式

仮定を式にすると，

$$
\frac{dS}{dt} = c\,A\,P(t) - kS,
\qquad
Q(t) = kS(t)
$$

である．
各項の意味と単位を整理する．

| 記号 | 意味 | 単位 |
| --- | --- | --- |
| $S(t)$ | 集水域に貯まっている水の量（状態変数） | 千m³ |
| $P(t)$ | 日降水量（外部入力） | mm/日 |
| $A$ | 集水面積 | km² |
| $c$ | 流出率．降った雨のうち流出に寄与する割合（パラメタ） | 無次元 |
| $k$ | 流出係数．貯留量のうち1日に流れ出る割合（パラメタ） | 1/日 |
| $cAP(t)$ | タンクに入る水量 | 千m³/日 |
| $kS$ | タンクから流れ出る水量．ダムへの流入量 $Q$ | 千m³/日 |

第6回の保存則と同じ形で，入る量が $cAP(t)$，出る量が $kS$ である．
$1/k$ は水がタンクに滞留する平均的な日数であり，$k = 0.5$ なら2日，$k = 0.05$ なら20日で入れ替わる．
雨が止んだ後の流出は $S_0 e^{-kt}$ に従って減るので，第2回の減衰モデルと同じ形である．

比較の対象は，モデルの出力 $Q(t) = kS(t)$ と観測された流入量である．
状態変数 $S$ 自体は観測されない．
ここでも，状態変数と観測量は別の量である．

### 実装と推定

```python
def tank_rhs(t, S, t_data, rain_data, c, k):
    """タンクモデル dS/dt = c A P(t) - k S の右辺．降水量は観測値の線形補間．"""
    return c * AREA_KM2 * np.interp(t, t_data, rain_data) - k * S


def simulate_tank(theta, S0, t_data, rain_data):
    """パラメタ theta = (c, k) と初期貯留量 S0 でタンクモデルを解き，流出量 Q = k S を返す．"""
    c, k = theta
    sol = solve_ivp(tank_rhs, (t_data[0], t_data[-1]), [S0], t_eval=t_data, args=(t_data, rain_data, c, k), max_step=1.0)
    return k * sol.y[0]


def residuals_tank(theta, t_data, rain_data, qin_data):
    """theta = (c, k, S0) における流出量の残差（モデル - 観測流入量）を返す．初期貯留量も推定する．"""
    c, k, S0 = theta
    return simulate_tank((c, k), S0, t_data, rain_data) - qin_data


theta_initial = [0.5, 0.1, 1000.0]                   # c, k [1/日], S0 [千m^3]
lower_bounds = [0.0, 1e-4, 0.0]
upper_bounds = [1.5, 5.0, 1e5]

result_tank = least_squares(residuals_tank, theta_initial, args=(t_data, rain_obs, qin_obs), bounds=(lower_bounds, upper_bounds))
c_hat, k_hat, S0_hat = result_tank.x
rmse_tank = np.sqrt(np.mean(result_tank.fun ** 2))

print("収束したか:", result_tank.success, " 評価回数:", result_tank.nfev)
print(f"推定値: c = {c_hat:.3f},  k = {k_hat:.3f} /日（平均滞留時間 {1 / k_hat:.1f} 日）,  S0 = {S0_hat:.0f} 千m^3")
print(f"流出量の RMSE: {rmse_tank:.0f} 千m^3/日（観測流入量の平均は {qin_obs.mean():.0f} 千m^3/日）")
```

```python
q_tank = simulate_tank((c_hat, k_hat), S0_hat, t_data, rain_obs)

fig, axes = plt.subplots(2, 1, figsize=(8, 7))
axes[0].plot(data["date"], qin_obs, color="black", label="observed inflow")
axes[0].plot(data["date"], q_tank, color="tab:red", label=f"tank model (c={c_hat:.2f}, k={k_hat:.2f} /day)")
axes[0].set_title(f"Tank model vs. observed inflow, {year}")
axes[0].set_ylabel("Flow [1000 m^3/day]")
axes[0].legend()

zoom = (data["date"] >= "2019-10-05") & (data["date"] <= "2019-10-31")
axes[1].bar(data["date"][zoom], rain_volume[zoom], color="tab:blue", alpha=0.4, width=1.0, label="rain volume c=1")
axes[1].plot(data["date"][zoom], qin_obs[zoom], color="black", marker="o", markersize=3, label="observed inflow")
axes[1].plot(data["date"][zoom], q_tank[zoom], color="tab:red", marker="s", markersize=3, label="tank model")
axes[1].set_title("Zoom: Typhoon Hagibis, October 2019")
axes[1].set_ylabel("Flow [1000 m^3/day]")
axes[1].set_xlabel("Date")
axes[1].legend()
for ax in axes:
    ax.grid(True)
fig.tight_layout()
fig.savefig(FIGURE_DIR / f"tank_model_{year}.png", dpi=150)
plt.show()

peak_index = int(np.argmax(qin_obs))
print(f"観測のピーク: {qin_obs[peak_index]:.0f} 千m^3/日（{data['date'][peak_index].date()}）")
print(f"モデルのピーク: {q_tank.max():.0f} 千m^3/日（{data['date'][int(np.argmax(q_tank))].date()}）")
```

推定された流出率は約0.73，流出係数は約0.40／日で，平均滞留時間は2.5日である．
年間を通した流入量の形はおおむね再現できるが，台風のピークはモデルの方が大幅に低く，1日遅れている．
日単位の降水量を線形補間して入力にしているため，511 mmの雨が2日にならされてしまうことと，1つのタンクでは「速い流出」と「遅い流出」を同時に表せないことが原因である．

````{note} 演習2：k の意味を確かめる

$c$ と $S_0$ は推定値に固定し，$k$ を手で変えて台風前後の流出量を描く．

```python
fig, ax = plt.subplots(figsize=(8, 4.5))
ax.plot(data["date"][zoom], qin_obs[zoom], color="black", marker="o", markersize=3, label="observed inflow")
for k_trial in [0.1, 0.4, 1.0]:
    q_trial = simulate_tank((c_hat, k_trial), S0_hat, t_data, rain_obs)
    ax.plot(data["date"][zoom], q_trial[zoom], label=f"k = {k_trial} /day (1/k = {1 / k_trial:.0f} days)")
    print(f"k = {k_trial}: ピーク {q_trial.max():7.0f} 千m^3/日,  ピークの日 {data['date'][int(np.argmax(q_trial))].date()}")
ax.set_title("Effect of the outflow coefficient k on the flood response")
ax.set_xlabel("Date")
ax.set_ylabel("Flow [1000 m^3/day]")
ax.grid(True)
ax.legend()
fig.tight_layout()
fig.savefig(FIGURE_DIR / "tank_k_sensitivity.png", dpi=150)
plt.show()
```

1. $k$ を大きくすると，ピークの高さと，雨が止んだ後の減り方はどう変わるか．表に記録する．
2. 台風のピークの高さに合わせようとすると $k$ は大きくしたい．一方，10月下旬の緩やかな減り方に合わせようとすると $k$ は小さくしたい．1つの $k$ でこの両方を表せないのはなぜか．
3. 現実の流域で，雨が「速く流れ出る経路」と「ゆっくり流れ出る経路」はそれぞれ何か．
````

````{note} 演習3：推定に使う年を変える

1. `year`を`2020`から`2023`に変えて同じ推定を行い，$c$，$k$，RMSE を表にする．
2. 推定値は年によってどのくらい変わるか．物理的な意味（流出率，滞留時間）から見て，年ごとに変わってよい量か．
3. 2019年で推定した $(c, k)$ を固定して別の年の流入量を計算し，その年で推定し直した場合と RMSE を比べる．これは第7回の訓練期間と検証期間の考え方と同じである．
````

## 発展3：2段タンクモデルと複雑化の代償

### 速い流出と遅い流出

1つのタンクでは表せなかった「速い流出と遅い流出」を，タンクを2つ並べて表す．
雨のうち割合 $f$ が速いタンク $S_1$ に，残りが遅いタンク $S_2$ に入り，それぞれ別の係数で流れ出るとする．

$$
\frac{dS_1}{dt} = f\,c\,A\,P(t) - k_1 S_1,
\qquad
\frac{dS_2}{dt} = (1 - f)\,c\,A\,P(t) - k_2 S_2,
\qquad
Q = k_1 S_1 + k_2 S_2
$$

状態変数が2つになったので，`solve_ivp`にはリスト`[S1, S2]`を渡し，右辺もリストを返す．
第10回で扱う連立微分方程式の書き方を，ここで先取りする．
パラメタは $c, k_1, k_2, f$ の4つに，初期貯留量 $S_{2,0}$ を加えて5つになる（速いタンクの初期値は0とする）．

````{dropdown} 発展演習：2段タンクの推定と初期値依存性

```python
def tank2_rhs(t, S, t_data, rain_data, c, k1, k2, f):
    """2段タンクモデルの右辺．S = [S1, S2]．速いタンクに割合 f，遅いタンクに 1-f の雨が入る．"""
    S1, S2 = S
    inflow = c * AREA_KM2 * np.interp(t, t_data, rain_data)
    return [f * inflow - k1 * S1, (1 - f) * inflow - k2 * S2]


def simulate_tank2(theta, S20, t_data, rain_data):
    """theta = (c, k1, k2, f) で2段タンクモデルを解き，流出量 Q = k1 S1 + k2 S2 を返す．"""
    c, k1, k2, f = theta
    sol = solve_ivp(tank2_rhs, (t_data[0], t_data[-1]), [0.0, S20], t_eval=t_data, args=(t_data, rain_data, c, k1, k2, f), max_step=1.0)
    return k1 * sol.y[0] + k2 * sol.y[1]


def residuals_tank2(theta, t_data, rain_data, qin_data):
    """theta = (c, k1, k2, f, S20) における流出量の残差を返す．"""
    c, k1, k2, f, S20 = theta
    return simulate_tank2((c, k1, k2, f), S20, t_data, rain_data) - qin_data


bounds2 = ([0.0, 0.05, 1e-4, 0.0, 0.0], [1.5, 5.0, 0.05, 1.0, 1e5])
initial_guesses_2 = [
    [0.5, 0.5, 0.02, 0.5, 5000.0],
    [0.3, 1.0, 0.01, 0.3, 2000.0],
    [0.8, 0.2, 0.03, 0.7, 8000.0],
]

print(f"1段タンク（3パラメタ）の RMSE: {rmse_tank:.0f} 千m^3/日")
print(f"{'初期値':>34} {'c':>6} {'k1':>6} {'k2':>7} {'f':>5} {'S20':>7} {'RMSE':>6}")
results_2 = []
for guess in initial_guesses_2:
    res2 = least_squares(residuals_tank2, guess, args=(t_data, rain_obs, qin_obs), bounds=bounds2)
    rmse2 = np.sqrt(np.mean(res2.fun ** 2))
    results_2.append((res2, rmse2))
    c2, k12, k22, f2, S202 = res2.x
    print(f"{str(guess):>34} {c2:6.2f} {k12:6.2f} {k22:7.4f} {f2:5.2f} {S202:7.0f} {rmse2:6.0f}")
```

```python
best_result, best_rmse = min(results_2, key=lambda item: item[1])
q_tank2 = simulate_tank2(best_result.x[:4], best_result.x[4], t_data, rain_obs)

fig, ax = plt.subplots(figsize=(8, 4.5))
ax.plot(data["date"][zoom], qin_obs[zoom], color="black", marker="o", markersize=3, label="observed inflow")
ax.plot(data["date"][zoom], q_tank[zoom], color="tab:red", linestyle="--", label=f"1 tank, RMSE {rmse_tank:.0f}")
ax.plot(data["date"][zoom], q_tank2[zoom], color="tab:purple", label=f"2 tanks, RMSE {best_rmse:.0f}")
ax.set_title("One-tank vs. two-tank model, October 2019")
ax.set_xlabel("Date")
ax.set_ylabel("Flow [1000 m^3/day]")
ax.grid(True)
ax.legend()
fig.tight_layout()
fig.savefig(FIGURE_DIR / "tank_one_vs_two.png", dpi=150)
plt.show()
```

1. 3つの初期値から得られた推定値は一致したか．RMSE はどう違うか．
2. 最も RMSE が小さい結果は，1段タンクより当てはまりが良い．しかし $c$ や $f$ の値は物理的に解釈できるか（例えば $c > 1$ は何を意味するか）．
3. 1段タンクの推定は初期値を変えても同じ値に収束した（確かめてみよ）．2段タンクではそうならないのはなぜか．パラメタの数と，データが持っている情報の量の関係から考える．
````

### 複雑化の利点と不利益

2段タンクは，パラメタを2つ増やすことで台風のピークと後の減衰を同時に表せるようになり，最良の場合には RMSE が1段タンクより3割ほど小さくなる．
これは複雑化の利点である．

しかし，同じデータに対して初期値を変えるだけで推定値が大きく変わり，RMSE も数百千m³の幅で違う．
$c$ が1を超える（降った雨より多くの水が流出する）結果が出ることもある．
パラメタが増えるほど，目的関数の地形には谷が増え，1つのデータからではどの谷が正しいか決められなくなる．
これが**識別可能性**の問題であり，複雑化の不利益である．

| 観点 | 1段タンク（3パラメタ） | 2段タンク（5パラメタ） |
| --- | --- | --- |
| 当てはまり（RMSE） | 約750千m³/日 | 約520〜970千m³/日（初期値による） |
| 推定の安定性 | 初期値を変えても同じ値に収束 | 初期値によって別の値に収束 |
| パラメタの解釈 | 流出率と滞留時間として説明できる | $c > 1$ など解釈できない値になることがある |
| 表せる現象 | 単一の減衰 | 速い流出と遅い流出 |

どちらを採用するかは，目的による．
「この流域では雨がどのくらいの時間で流れ出るか」を1つの数で説明したいなら1段タンクで十分である．
「洪水のピークを予測したい」なら2段以上が必要だが，その場合は複数年のデータで推定値が安定することを確かめなければ使えない．
複雑なモデルが常に良いとは限らない，という第4回の教訓が，ここでも成り立つ．

## モデルの限界と改善の問い

- 秩父の1地点の降水量で流域全体の雨を代表させている．流域内に複数の雨量観測所があれば，平均を取るべきである
- 日単位のデータでは，1日の中の雨の集中を表せない．時間単位のデータが手に入れば，台風のピークの再現は改善するはずである
- 蒸発と浸透を一定の割合 $1 - c$ で表したが，実際には季節（気温，植生）によって変わる．$c$ を季節の関数にする拡張が考えられる
- 雪は降った日ではなく融けた日に流出する．冬から春のデータでは，融雪を表す仕組みが必要になる
- 3つ以上のタンクを直列につなぐ古典的なタンクモデルや，地下水を表す遅いタンクなど，発展の方向は多い．どれも「パラメタを増やす代償」を伴う

## まとめ

- 観測データとして与えていた量に仮定を置いてモデルの中に取り込むと，データがなくても計算できるようになり，「もし」を問えるようになる．その代わり仮定が増える
- 流出量を $kV$ で表す仮定は，自然の湖や集水域には合うが，人が操作するダムの放流量には合わない．仮定は現象の仕組みに合わせて選ぶ
- タンクモデル $S' = cAP(t) - kS$，$Q = kS$ は，降水量を入力として流出の遅れとなだらかな減衰を表す．降水量 mm/日 に集水面積 km² を掛けると 千m³/日 になる
- パラメタを増やすと当てはまりは良くなるが，推定値が初期値に依存し，物理的に解釈できない値になることがある．複数の初期値，複数の年で推定値の安定性を確かめる
- モデルの複雑さは目的に合わせて選ぶ．当てはまりの良さだけで選んではいけない

## 課題

````{warning} 課題1：1段タンクと2段タンクの比較表

2019年以外の年を1つ選び，次を行う．

1. 1段タンクと2段タンクのパラメタをそれぞれ推定する．2段タンクは3つ以上の初期値から推定し，結果をすべて記録する．
2. 「複雑化の利点と不利益」の表と同じ4つの観点で，その年の結果を表にまとめる．
3. 観測流入量，1段タンク，2段タンク（最良の結果）を1枚の図に描き，`reports/figures/`に保存する．その年で最も流入量が大きかった期間の拡大図も添える．
4. どちらのモデルを採用するか，目的を1つ決めたうえで理由を3行程度で書く．
````

````{warning} 課題2：仮定は現象に合わせて選ぶ

次の2つの主張を比べ，どちらが妥当かを今回の結果を根拠にして200字程度で論じる．

- 「$Q_{\mathrm{out}} = kV$ という仮定はダムの放流量に合わなかった．したがってこの仮定は使うべきでない」
- 「$Q_{\mathrm{out}} = kV$ という仮定は，ダムの放流量には合わないが，集水域からの流出には合った．仮定の良し悪しは現象による」

`README.md`とNotebookと図をまとめて，WebClassの指示に従って提出する．
````

## 次回への接続

今回のタンクモデルでは，外部入力の降水量は不規則に変動する観測データだった．
第9回では，外部入力が周期的に変動する現象を扱う．
観光客数や電力需要は，年周期，週周期，日周期といった規則的な変動を持つ．
$A\sin(2\pi t/T + \phi)$ で表される周期関数の振幅，周期，位相を理解し，ベースラインとトレンドと周期成分を組み合わせて観測データの周期性を説明する．
今回と同じく，`np.interp`で与えていた入力を，今度は式で与えることになる．

## 自分の言葉で説明する問い

1. 放流量を観測データとして与えるモデルと，$kV$ としてモデル化するモデルは，それぞれどのような目的に向いているか．浦山ダムではなぜ後者が合わなかったか．
2. タンクモデルの $c$ と $k$ はそれぞれ現象の何を表しているか．$1/k$ の意味も含めて説明せよ．
3. 降水量 mm/日 を 千m³/日 に換算する手順を，単位の計算を示して説明せよ．
4. 「パラメタを増やしたら当てはまりが良くなった」という結果を見て，そのモデルを採用する前に確かめるべきことは何か．2つ挙げよ．
